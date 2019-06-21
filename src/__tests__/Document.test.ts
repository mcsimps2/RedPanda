//Initialize everything in here
import RedPanda from '../';
import User from './User';
import Business from './Business';
import Organization from './Organization';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import * as firebase from '@firebase/testing';
import sinon from 'sinon';

// Testing setup
chai.use(sinonChai);
const expect = chai.expect;

// Firebase setup

firebase.clearFirestoreData({
    projectId: 'test-odm'
})

const app = firebase.initializeAdminApp({
    projectId: 'test-odm'
})

const db = app.firestore();

RedPanda.connect(db);

describe('UserDocument', () => {
    describe('constructor', () => {
        it('validates the fields', () => {
            // Invalid email
            try {
                const user = new User({
                    email: 'hello'
                });
                expect(true).to.be.false;
            }
            catch (e) {
                expect(e.message).to.be.equal('"email" must be a valid email')
            }

            // Valid email, no error thrown
            const user = new User({
                email: 'hello@gmail.com'
            });
            expect(true).to.be.true;

            // Email is a required field
            try {
                const user = new User({
                    first: 'Matt'
                });
                expect(true).to.be.false;
            }
            catch (e) {
                expect(e.message).to.be.equal('"email" is required');
            }
        })


        it('removes unknown fields if the strict option is set', () => {
            const user = new User({
                email: 'hello@gmail.com',
                unknownfield: 'uhoh'
            }, undefined, true);
            expect(user.email).to.be.equal('hello@gmail.com');
            expect(user.unknownfield).to.not.exist;
        })

        it('allows unknown fields if the strict option is not set', () => {
            // strict is set to true on user, so need to explicitly say false
            // because undefined doesn't work
            const user = new User({
                email: 'hello@gmail.com',
                unknownfield: 'uhoh'
            }, undefined, false);
            expect(user.email).to.be.equal('hello@gmail.com');
            expect(user.unknownfield).to.be.equal('uhoh');
        })
    })

    describe('db', () => {
        it('gets the database connected to by RedPanda', () => {
            RedPanda.connect(db);
            const expected_db = RedPanda.db;
            const actual_db = User.db;
            expect(actual_db).to.be.equal(expected_db);
        })
    })

    describe('coll_ref', () => {
        it('defaults the collection to be the class name', () => {
            expect(User.coll_name).to.be.equal('user')
        })

        it('allows you to specify a name for the collection', () => {
            const name = 'custom_users';
            User.coll_name = name;
            expect(User._coll_name).to.be.equal(name);
        })
    })

    describe('getAttributes', () => {
        let user, business

        beforeEach(async () => {
            user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt'
            });
            await user.save();

            // Try setting user on creation by id
            business = new Business({
                name: 'The Cherrypickers',
                user: user.id
            });
        })

        it('gets all regular fields and Document fields as IDs', async () => {
            // Include the business ID (null rn)
            let attributes = business.getAttributes(true);
            expect(attributes).to.be.eql({
                name: 'The Cherrypickers',
                user: user.id,
                id: null
            });
            
            business = new Business({
                name: 'The Cherrypickers',
                user: user
            });

            business.save();

            // Don't include business ID
            attributes = business.getAttributes();
            // Retrieve the user to use in comparisons
            expect(attributes).to.be.eql({
                name: 'The Cherrypickers',
                user: user.id
            });

            const id = await business.save();
            attributes = business.getAttributes(true);
            expect(attributes).to.be.eql({
                name: 'The Cherrypickers',
                user: user.id,
                id: id
            });
        })

        it('gets dbreflists as arrays of ids', async () => {
            let user, business, business2, business3, business4
            user = new User({
                email: 'ziwamukungu@gmail.com',
                last: 'Mukungu'
            });
            await user.save();
            business = new Business({
                name: 'The Goodie Ol Cherrypickers',
                user: user,
                meta: 1
            });
            await business.save();
            business2 = new Business({
                name: 'The Goodie Ol Cherrypickers2',
                user: user,
                meta: 2
            });
            await business2.save();

            business3 = new Business({
                name: 'The Goodie Ol Cherrypickers',
                user: user,
                meta: 3
            });
            await business3.save();

            business4 = new Business({
                name: 'The Goodie Ol Cherrypickers',
                user: user,
                meta: 4
            });
            await business4.save();

            const org = new Organization({
                name: 'The Goodie Cherrypicker Organization',
                businesses: [business, business2, business3, business4]
            });
            const id = await org.save();

            const attributes = org.getAttributes(true);
            expect(attributes).to.be.eql({
                name: 'The Goodie Cherrypicker Organization',
                businesses: [business.id, business2.id, business3.id, business4.id],
                id: id
            }); 
        })

        it('allows any attributes regardless of strict setting', async () => {
            business.blah = 'hi';
            const attributes = business.getAttributes();
            expect(attributes).to.be.eql({
                name: 'The Cherrypickers',
                user: user.id,
                blah: 'hi'
            });
        })

        it('removes any undefined values during sanitation', async () => {
            business.blah = undefined;
            const attributes = business.getAttributes();
            expect(attributes).to.be.eql({
                name: 'The Cherrypickers',
                user: user.id
            });
        })
    })

    describe('validate', () => {
        it('strips unknowns if strict is set', () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                unknownfield: 'somevalue'
            });
            const data = user.validate(true);
            expect(data).to.be.eql({
                email: 'mattsimpson@gmail.com'
            });
        })

        it('allows unknowns if strict is false', () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                unknownfield: 'somevalue'
            }, undefined, false);
            const data = user.validate(false);
            expect(data).to.be.eql({
                email: 'mattsimpson@gmail.com',
                unknownfield: 'somevalue'
            });
        })
    })

    describe('update', () => {
        it('updates an object with the given data if it passes validation', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
            });
            const id = await user.update({
                email: 'matty@gmail.com'
            });
            const actual = await User.findByID(id);
            expect(actual.email).to.be.equal('matty@gmail.com');
        })

        it('adds new fields', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
            }, undefined, false);
            const id = await user.update({
                email: 'matty@gmail.com',
                newfield: 'newvalue'
            }, false);
            const actual = await User.findByID(id);
            expect(actual.email).to.be.equal('matty@gmail.com');
            expect(actual.newfield).to.be.equal('newvalue');
        })

        it('raises an error if validation is not passed', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
            });
            try {
                await user.update({
                    email: 'matty@gmail.com',
                    unknownfield: 'somevalue'
                });
                expect(true).to.be.false;
            }
            catch (e) {
                expect(true).to.be.true;
            }
        })

        it('rolls back upon a save error', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com'
            }, undefined, false);
            const save_stub = sinon.stub(user, 'save').throws();
            try {
                await user.update({
                    email: 'changedemail@gmail.com',
                    unknownfield: 'uhohvalue'
                })
                expect(true).to.be.false;
            } catch (e) {
                expect(user.email).to.be.equal('mattsimpson@gmail.com');
                expect(user.unknownfield).to.not.exist;
            }
        })
    })

    describe('save', () => {
        it('saves the document to the database if it is new with auto-generated id', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt'
            });
            await user.save();
            expect(user.doc_ref).to.exist;
            expect(user.id).to.exist;
        })

        it('saves the document to the database with a specified id', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt',
            }, 'xxxxxxxxx');
            await user.save();
            expect(user.doc_ref).to.exist;
            expect(user.id).to.be.equal('xxxxxxxxx')

            const actual = await User.findByID('xxxxxxxxx');
            expect(actual).to.exist;
            expect(actual.email).to.be.equal('mattsimpson@gmail.com');
        })

        it('updates the document if it is not new', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt'
            });
            await user.save();
            user.email = 'matty@gmail.com';
            const id = await user.save();
            const actual = await User.findByID(id);
            expect(actual.email).to.be.equal('matty@gmail.com');
        })
    })

    describe('reload', () => {
        it('reloads the object with updated fields', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt'
            });
            const id = await user.save();
            const user2 = await User.findByID(id);
            user.email = 'updatedemail@gmail.com';
            await user.save();
            await user2.reload();
            expect(user2.email).to.be.equal('updatedemail@gmail.com')
        })
    });

    describe('delete', () => {
        it('deletes the object in the database', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt'
            });
            const id = await user.save();
            await user.delete();
            const actual = await User.findByID(id);
            expect(actual).to.not.exist;
        })
    })

    describe('schema', () => {
        it('picks out foreign keys', () => {
            const schema = {
                name: RedPanda.types.string().required(),
                user: RedPanda.types.dbref().collection(User).required()
            };
            Business.schema = schema;
            expect(Business.schema).to.be.eql(schema);
            expect(Object.keys(Business.foreign_keys)).to.be.eql(['user']);
        })

        it('sets setters and getters for foreign keys', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt'
            });
            await user.save();

            // Try setting user on creation by id
            let business = new Business({
                name: 'The Cherrypickers',
                user: user.id
            });
            
            let retrieved_user = await business.user;
            expect(retrieved_user.id).to.be.equal(user.id);
            expect(retrieved_user.first).to.be.equal('Matt');
            expect(retrieved_user.last).to.not.exist;
            expect(retrieved_user.email).to.be.equal('mattsimpson@gmail.com')
            expect(business.__id__user).to.be.equal(user.id);

            business = new Business({
                name: 'The Cherrypickers',
                user: user
            });

            retrieved_user = await business.user;
            expect(retrieved_user.id).to.be.equal(user.id);
            expect(retrieved_user.first).to.be.equal('Matt');
            expect(retrieved_user.last).to.not.exist;
            expect(retrieved_user.email).to.be.equal('mattsimpson@gmail.com')
            expect(business.__id__user).to.be.equal(user.id);

            // Try setting a user
            const user2 = new User({
                email: 'ziwamukungu@gmail.com',
                first: 'Ziwa',
                last: 'Mukungu'
            });
            await user2.save();
            business.user = user2.id;
            retrieved_user = await business.user;
            expect(retrieved_user.id).to.be.equal(user2.id);
            expect(retrieved_user.first).to.be.equal('Ziwa');
            expect(retrieved_user.last).to.be.equal('Mukungu');
            expect(retrieved_user.email).to.be.equal('ziwamukungu@gmail.com')
            expect(business.__id__user).to.be.equal(user2.id);

            const user3 = new User({
                email: 'ziwamukungu@gmail.com',
                last: 'Mukungu'
            });
            await user3.save();
            business.user = user3;
            retrieved_user = await business.user;
            expect(retrieved_user.id).to.be.equal(user3.id);
            expect(retrieved_user.first).to.not.exist;
            expect(retrieved_user.last).to.be.equal('Mukungu');
            expect(retrieved_user.email).to.be.equal('ziwamukungu@gmail.com')
            expect(business.__id__user).to.be.equal(user3.id);
        })

        it('allows arrays of foreign keys', async () => {
            let user, business, business2, business3, business4
            user = new User({
                email: 'ziwamukungu@gmail.com',
                last: 'Mukungu'
            });
            await user.save();
            business = new Business({
                name: 'The Good Ol Cherrypickers',
                user: user,
                meta: 1
            });
            await business.save();
            business2 = new Business({
                name: 'The Good Ol Cherrypickers2',
                user: user,
                meta: 2
            });
            await business2.save();

            business3 = new Business({
                name: 'The Good Ol Cherrypickers',
                user: user,
                meta: 3
            });
            await business3.save();

            business4 = new Business({
                name: 'The Good Ol Cherrypickers',
                user: user,
                meta: 4
            });
            await business4.save();

            let org = new Organization({
                name: 'The Cherrypicker Organization',
                businesses: [business, business2, business3, business4]
            });

            let id = await org.save();
            let businesses = await org.businesses;
            expect(businesses.length).to.be.equal(4);
            expect(businesses[0].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[1].name).to.be.equal('The Good Ol Cherrypickers2');
            expect(businesses[2].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[3].name).to.be.equal('The Good Ol Cherrypickers');

            let actual_org = await Organization.findByID(id);
            businesses = await actual_org.businesses;
            expect(businesses.length).to.be.equal(4);
            expect(businesses[0].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[1].name).to.be.equal('The Good Ol Cherrypickers2');
            expect(businesses[2].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[3].name).to.be.equal('The Good Ol Cherrypickers');

            org = new Organization({
                name: 'The Cherrypicker Organization',
                businesses: [business.id, business2.id, business3.id, business4.id]
            });
            id = await org.save();
            businesses = await org.businesses;
            expect(businesses.length).to.be.equal(4);
            expect(businesses[0].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[1].name).to.be.equal('The Good Ol Cherrypickers2');
            expect(businesses[2].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[3].name).to.be.equal('The Good Ol Cherrypickers');

            actual_org = await Organization.findByID(id);
            businesses = await actual_org.businesses;
            expect(businesses.length).to.be.equal(4);
            expect(businesses[0].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[1].name).to.be.equal('The Good Ol Cherrypickers2');
            expect(businesses[2].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[3].name).to.be.equal('The Good Ol Cherrypickers');
            
            // Mix of ids and objects
            org = new Organization({
                name: 'The Cherrypicker Organization',
                businesses: [business, business2.id, business3, business4.id]
            });
            id = await org.save();

            businesses = await org.businesses;
            expect(businesses.length).to.be.equal(4);
            expect(businesses[0].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[1].name).to.be.equal('The Good Ol Cherrypickers2');
            expect(businesses[2].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[3].name).to.be.equal('The Good Ol Cherrypickers');

            actual_org = await Organization.findByID(id);
            businesses = await actual_org.businesses;
            expect(businesses.length).to.be.equal(4);
            expect(businesses[0].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[1].name).to.be.equal('The Good Ol Cherrypickers2');
            expect(businesses[2].name).to.be.equal('The Good Ol Cherrypickers');
            expect(businesses[3].name).to.be.equal('The Good Ol Cherrypickers');
        })
    })

    describe('Document.findByID', () => {
        it('gets an object by ID', async () => {
            const user = new User({
                email: 'mattsimpson@gmail.com',
                first: 'Matt'
            });
            const id = await user.save();
            const actual = await User.findByID(id);
            expect(user.getAttributes()).to.be.eql(actual.getAttributes());
        })
    })

    describe('Document queries (where, orderBy, limit, find, update)', () => {
        let user, business, business2, business3, business4

        it('finds queried objects', async () => {
            user = new User({
                email: 'ziwamukungu@gmail.com',
                last: 'Mukungu'
            });
            await user.save();
            business = new Business({
                name: 'The New Cherrypickers',
                user: user,
                meta: 1
            });
            await business.save();
            business2 = new Business({
                name: 'The Cherrypickers2',
                user: user,
                meta: 2
            });
            await business2.save();

            business3 = new Business({
                name: 'The New Cherrypickers',
                user: user,
                meta: 3
            });
            await business3.save();

            business4 = new Business({
                name: 'The New Cherrypickers',
                user: user,
                meta: 4
            });
            await business4.save();

            const query = await Business.where('name', '==', 'The New Cherrypickers').orderBy('meta', 'desc').limit(2).get();
            expect(query.length).to.be.equal(2);
            let actual = query[0];
            expect(actual.name).to.be.equal('The New Cherrypickers');
            expect(actual.meta).to.be.equal(4);
            actual = query[1];
            expect(actual.name).to.be.equal('The New Cherrypickers');
            expect(actual.meta).to.be.equal(3);
        })

        it('updates query objects', async () => {
            const query = await Business.where('name', '==', 'The New Cherrypickers');
            const ids = await query.update({
                name: 'The Old Cherrypickers'
            });
            expect(ids.length).to.be.equal(3);
            const old_query_res = await query.get();
            expect(old_query_res).to.be.eql([]);
            const new_query_res = await Business.where('name', '==', 'The Old Cherrypickers').get();
            expect(new_query_res.length).to.be.equal(3);
        })

        it('retrieves updated query objects', async () => {
            const query = await Business.where('name', '==', 'The Old Cherrypickers').update({
                name: 'Ye Old Cherrypickers'
            }, true);
            expect(query.length).to.be.equal(3);
            query.forEach((biz) => {
                expect(biz.name).to.be.equal('Ye Old Cherrypickers');
            })
        })
        
    })
})
import RedPanda from '../'
import User from './User'
import Business from './Business';

const OrganizationDocument =  RedPanda.create('Organization', {
    name: RedPanda.types.string().required(),
    businesses: RedPanda.types.dbreflist().collection(Business)
});

class Organization extends OrganizationDocument {
    
}

export default Organization
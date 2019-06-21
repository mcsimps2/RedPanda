import * as Joi from '@hapi/joi';
import Document from './Document';
import { firestore } from 'firebase';

// namespace Joi {
//     const FOREIGN_KEY = '__foreign_key' 
// }

// // export default Object.freeze({
// //     FOREIGN_KEY: '__foreign_key'
// // });

// //@ts-ignore
// Joi.FOREIGN_KEY = '__foreign_key';
// export default Joi;

// declare module 'Joi'{
//     export function dbref(): Joi.ObjectSchema;
// }

declare module '@hapi/Joi'{
    export function dbref(): any;
    export function dbreflist(): any;
}

let rp_types: typeof Joi = Joi.extend((joi) => ({
    name: 'dbref',
    pre(value, state, options) {
        // Convert any references to ids during validation
        if (value instanceof Document) {
            return value.id;
        }
        else if (typeof value === 'string') {
            return value;
        }
        else {
            return this.createError('dbref.collection', { message: 'Must be a Document subclass instance or ID' }, state, options);
        }
    },
    language: {
        collection: 'needs to be a Document subclass instance or Document ID'
    },
    rules: [
        {
            name: 'collection',
            params: {
                collection: joi.any().required()
            },
            setup(params) {
                if (!params.collection || !params.collection.prototype || !(params.collection.prototype instanceof Document)) { // Class
                    return this.createError('dbref.collection', { message: 'No valid type passed' });
                }
                this._collection = params.collection;
            },
            validate(params, value, state, options) {
                return value;
                // if (value instanceof Document) {
                //     return value.id;
                // }
                // else if (typeof value === 'string') {
                //     return value;
                // }
                // else {
                //     return this.createError('dbref.collection', { message: 'Must be a Document subclass instance or ID' }, state, options);
                // }
            }
        }
    ]
}));

rp_types = rp_types.extend((joi) => ({
    name: 'dbreflist',
    base: joi.array(),
    pre(value, state, options) {
        if (!Array.isArray(value)) {
            return this.createError('dbref.collection', { message: 'Must be an array of ids or document subclass instances' }, state, options);
        }
        const ids = [];
        for (let i = 0; i < value.length; i++) {
            if (value[i] instanceof Document) {
                ids.push(value[i].id);
            }
            else if (typeof value[i] === 'string') {
                ids.push(value[i]);
            }
            else {
                return this.createError('dbref.collection', { message: 'Must be an array of ids or document subclass instances' }, state, options);
            }
        }
        return ids;
    },
    language: {
        collection: 'Must be an array of ids or document subclass instances'
    },
    rules: [
        {
            name: 'collection',
            params: {
                collection: joi.any().required()
            },
            setup(params) {
                if (!params.collection || !params.collection.prototype || !(params.collection.prototype instanceof Document)) { // Class
                    return this.createError('dbref.collection', { message: 'No valid type passed' });
                }
                this._collection = params.collection;
            },
            validate(params, value, state, options) {
                return value;
            }
        }
    ]
}))



export default rp_types
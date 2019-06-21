import Document from './Document';
import Types from './Types';
import { firestore } from 'firebase';

export default class RedPanda {
    static db: firestore.Firestore
    
    static connect(db: firestore.Firestore) {
        this.db = db;
    }
    static types = Types;

    static create(name: string, schema: object, strict = false, collection?: string|firestore.CollectionReference) {
        // const new_doc: Document = class extends Document {}
        // Object.defineProperty(new_doc, 'name', {value: name});
        // Another clever way to do this:
        const class_generator = (name: string, cls: any) => ({[name] : class extends cls {}})[name];
        const new_doc = class_generator(name, Document);

        // Initialize the new document type with everything it needs
        new_doc.initialize(schema, strict, collection);

        return new_doc as unknown as typeof Document;

        // Old protoype bindings
        // function NewDocument() {
        //   // Call the parent constructor
        //   Document.call(this);
        // }

        // // Get static methods & properties
        // Object.assign(NewDocument, Document);

        // // inherit Document
        // NewDocument.prototype = Object.create(Document.prototype);

        // // correct the constructor pointer because it points to superclass
        // NewDocument.prototype.constructor = NewDocument;
    }
}
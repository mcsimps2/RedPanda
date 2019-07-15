import * as Joi from "@hapi/joi";
import { firestore } from "firebase";
import Document from "./Document";
import Types from "./Types";

declare module "@hapi/Joi" {
    export function dbref(): any;
    export function dbreflist(): any;
}

export default class RedPanda {
    public static db: firestore.Firestore;
    public static types: typeof Joi & { [x: string]: any } = Types;

    // @ts-ignore
    // TS ignore because Firestore has messed up types
    public static connect(db: any|firestore.Firestore) {
        this.db = db as unknown as firestore.Firestore;
    }

    public static create(name: string, schema: object, strict?: boolean,
                         collection?: string|firestore.CollectionReference): typeof Document;
    public static create(name: string, schema: object, strict = false,
                         collection?: string|firestore.CollectionReference): typeof Document {
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


## Table of Contents
- [Installing](#installing)
- [Connecting to Firestore](#connecting-to-the-firestore-database)
	- [RedPanda.connect](#redpandaconnectdb-firestore)
- [Defining Documents](#defining-document-classes-and-schemas)
	- [RedPanda.create](#redpandacreatecls_name-string-schema-object-strict-boolean-collection-stringcollectionreference-class)
		- [Foreign Keys in Schemas](#foreign-keys-in-schemas)
- [Instantiating Documents](#instantiating-documents)
	- [Adding foreign keys to a document](#adding-foreign-keys-to-a-document)
- [Accessing Document Attributes](#accessing-document-attributes)
	- [Foreign Key Attributes ($lookup and JOIN)](#foreign-key-attributes-lookup-and-join)
- [Instance Methods and Attributes](#instance-methods-and-attributes)
	- [id](#id-string)
	- [save](#save-id)
	- [reload](#reloadrecursive-boolean)
	- [update](#updatedata-object-id)
	- [delete](#delete-id)
	- [listen](#listencontext-function)
	- [doc_ref](#doc_ref-documentreference)
	- [foreign key IDs](#__id__foreignkey-string)
- [Class Methods and Attributes](#class-methods-and-attributes)
	- [Document.coll_ref](#documentcoll_ref-collectionreference)
- [Querying the Database](#querying-the-database)
	- [findByID](#findbyidid-string-options-populate-string-populateall-boolean)
	- [where, orderBy, limit, get](#where-orderby-limit-get)
	- [select projection queries](#select-projection-queries)
	- [count](#count-promiseint)
	- [update](#updatedata-object-retrieve-boolean)
	- [listen](#listencontext-function)
- [Subcollections](#subcollections)


## Installing
Make sure you have Firebase installed (or the relevant flavor you need for your application).

`npm install --save firebase # or firebase-admin for Node applications`

`npm install --save redpanda-odm`

## Connecting to the Firestore database
### `RedPanda.connect(db: Firestore)`
RedPanda currently only supports one database connection at a time.  Call this as early in your application as possible; the database must be connected before any database reads/writes can be performed.
Example:
```
const db = firebase.initializeApp(config).firestore();
RedPanda.connect(db);
```


## Defining Document Classes and Schemas
Start off by defining your schemas.
### `RedPanda.create(cls_name: string, schema: object, strict?: boolean, collection?: string|CollectionReference): class`
Creates a class with the given class name `cls_name` and schema `schema` to define documents for a given collection.  Documents will be instances of this new class.  `cls_name` should be the name of the collection (e.g. User, Business, etc...) unless you want to specify a collection reference manually (see below).
- `schema`: For defining schemas, Red Panda provides an extension of [joi](https://github.com/hapijs/joi) accessible via `RedPanda.types` with added support for `dbref` (foreign keys/documents) and `dbreflist` (array of foreign keys/documents). 
 - `strict`: strict mode indicates that unknown fields not defined in the `schema` object should be not be saved to the database; it is set, by default, to `false`.
 - `collection`: The collection to which document instances of `cls_name` will be saved defaults to the snakecase class name (e.g. "AuthToken" saves to the collection "auth_token").  However, a `collection` name or Firestore reference may be passed in to override this.
 
#### Example
```
const UserDocument = RedPanda.create('User', {
  email: RedPanda.types.string().email().required(),
  first_name: RedPanda.types.string().max(30),
  last_name: RedPanda.types.string().max(30),
  birth_year: RedPanda.types.number().integer().min(1900).max(2019)
});
// UserDocuments will be saved in the collection 'user' by default
```

A call to `RedPanda.create` creates a class, whose instances have access to the object methods below.  Thus, it is completely valid to instantiate `UserDocument` and start making calls to `.save()`. 
```
const user = new UserDocument({ email: 'demo_email@gmail.com'})
await user.save()
```

However, you probably want to subclass this returned class to add additional methods, TypeScript definitions, etc...

```
class User extends UserDocument {
  email: string
  first_name: string
  last_name: string
  
  get fullName() {
    return this.first_name + ' ' + this.last_name
  }
  
  async generateAuthToken() {
    ...
  }
  
  async sendConfirmationEmail() {
    ...
  }
  ...
}
```

This provides for a more elegant workflow.
```
const user = new User({ email: 'demo_email@gmail.com'})
await user.save();
await user.sendConfirmationEmail();
```

#### Foreign Keys in Schemas
Use `dbref` to indicate a foreign key in a schema:
```
const UserDocument = RedPanda.create('User', {...});
class User extends UserDocument {...}

// A Business is controlled/owned by a user
const BusinessDocument = RedPanda.create('Business', {
    name: RedPanda.types.string().required(),
    user: RedPanda.types.dbref().collection(User).required()
});

class Business extends BusinessDocument { ... }
```

Similarly, use `dbreflist` to indicate a list of foreign keys:
```
// A Franchise is a collection of businesses
const FranchiseDocument =  RedPanda.create('Franchise', {
    name: RedPanda.types.string().required(),
    entities: RedPanda.types.dbreflist().collection(Business).required()
});

class Franchise extends Franchise { ... }
```



## Instantiating Documents
### `constructor(data?: object, id?: string)`
Instantiates an object with the given attributes from `data`.  You may also set the attributes later through dot syntax, e.g. `user.email = ...`.  If an `id` is passed, then the object will assume that ID when saving and loading from the database.  Otherwise, one will be automatically generated.  The data is *NOT* validated at this point, but rather when the document is saved to the database.

#### Adding Foreign Keys to a Document
When dealing with foreign keys, you may pass either an foreign ID or an foreign document as part of the data, as shown below.
```
const person = new Person({
  email: "demo_email@gmail.com",
  first_name: "Jeff",
  last_name: "Bezos"
});

/* OR
const person = Person();
person.email = "demo_email@gmail.com";
person.first_name = "Jeff";
person.last_name = "Bezos";
*/

// user must be saved first since recursive saves are not yet supported
await person.save();

const amazon = new Company({
  name: "Amazon",
  address: "410 Terry Ave. North, Seattle, WA, 98109",
  ceo: person
});

/* OR
const amazon = new Business({
  name: "Amazon",
  address: "410 Terry Ave. North, Seattle, WA, 98109",
  ceo: person.id
});
*/
```
The difference between the two is that, in the first case, the CEO Person document will be immediately accessible via `amazon.ceo`, but in the second case, `amazon.ceo` returns a promise that needs to resolve in order to access the user object since only an ID was passed.

Likewise, with arrays of foreign keys:
```
const groupChat = new GroupChat({
  name: 'Marketing Team Group Chat',
  users: [user1, user2, user3]
})

/* OR
const groupChat = new GroupChat({
  name: 'Marketing Team Group Chat',
  users: [user1.id, user2.id, user3.id]
})
*/
```

## Accessing Document Attributes
Attributes that are not references to foreign documents can be accessed normally.
```
const user = new User({ email: 'john_doe@gmail.com', first_name: 'John', last_name: 'Doe' });
await user.save();

console.log("User email is", user.email);

const full_name = user.first_name + user.last_name;
console.log("User full name is", full_name);
```

#### Foreign Key Attributes ($lookup and JOIN)
Attributes that are references to foreign documents, or are lists of foreign documents, can be resolved in one of two ways.

**(1) Resolve during query** You can ask RedPanda to automatically populate any foreign documents during a query in `findByID()` or in `get()`:
```
// This will automatically $lookup (JOIN) the employee to the employee's company object in the Company database.
// We can also populate nested foreign documents with "." dot syntax - here, we also dereference the company's CEO as well,
// which is a "Person" document in "person" collection
const employee = await Employee.findByID("XXXXXXXX", {
    populate: ["company", "company.ceo"]
}
console.log("The employee's company is ", user.company.name);  // The employee's company is "Amazon"
console.log("The company's CEO is ", employee.company.ceo.firstName, employee.company.ceo.lastName);  // The company's CEO is Jeff Bezos

// You can also automatically populate all foreign references recursively or non-recursively
const employees = await Employee.where("zipcode", "==", "27606").get({
      populateAll: true // use "false" to populate foreign references non-recursively
});
```

**(2) Resolve after a query** You can still access a foreign document after a query has been made, even if you have not used the "populate" option.

When you access an attribute that is a foreign reference, it either returns the document if it is already retrieved or returns a promise to the document.
```
const employee = await Employee.findByID("XXXXXXX");

// Since the company document has not been retrieved, we must first fetch it
const company = await employee.company;

console.log("The company is ", company.name);  // The company is Amazon

// Now that the company document has been retrieved, we can access it normally without promises
const address = employee.company.address;  // No more async/await syntax needed now
console.log("The address is ", address);  // The address is 
```

**Note** Since accessing a foreign reference attribute returns a promise, this may not be ideal for users who need to just access the `id` of the foreign document.  To get around this, you may access just the ID of a foreign document by looking at the field `document.__id__<name_of_property`:
```
const employee = await Employee.findByID("XXXXX");
const companyID = employee.__id__company;  // "XiDj72kfse92"
```


## Instance Methods and Attributes
The following methods and attributes are available on all document instances.
### `id: string`
The ID of the document.  If no ID is specified in the constructor, then the `id` field is auto-generated and only present after `save()` has been called.

```
const user = new User({ email: 'john_doe@gmail.com' });
await user.save();

console.log("The ID of the user is ", user.id); // The ID of the user is 91x827sjhag
```

### `save(): ID`
Saves the document to the database and returns the ID of the document.  The document attributes will be validated against the pre-defined schema at this point and an error may be thrown if the schema is not satisfied.  If `strict` mode is on, then `save()` will silently ignore any fields not found in the schema.
Recursive saves are not yet supported, so any foreign documents must already be saved at this point.

Example:
```
const user = new User({ email: 'john_doe@gmail.com' });
await user.save();

// Change the email
user.email = "jeff_bezos@amazon.com";
await user.save();
```

### `reload(recursive: boolean)`
Reloads the document to reflect the latest version in the database.  If `recursive` is true, then foreign documents are also fetched.

### `update(data: object): ID`
Updates the document with the given data and saves it to the database.  Returns the ID of the document.  Throws an error if any fields are invalid according to the class schema.  If `strict` mode is on, then `save()` will silently ignore any fields not found in the schema.

Example:
```
const user = User.findByID('182371kjf8hs9d');
await user.update({ email: 'mary_doe@gmail.com' });
```

### `delete(): ID`
Deletes the document in the database and returns the ID.

Example:
```
const user = User.findByID('182371kjf8hs9d');
await user.delete();
```

### `populate(fields: string[])`
Populates the specified foreign references in the document.  Nested foreign references can be populated with in the dot syntax format of `<foreign_key>.<nested_foreign_key>...` to an unlimited depth.

Example:
```
employee.populate(["company", "company.ceo"]);
// company is a document in the Company collection, "company.ceo" is a document in the Person collection
console.log("The company is ", employee.company);
console.log("The company's CEO is ", employeee.company.ceo.firstName, ecmployee.company.ceo.lastName);
```

### `listen(context): Function`
Listens to the document for changes.  `context` is a dictionary with the structure
```
{
	onNext: (doc: Document) => void,
	onError?: (error: Error) => void,
	onCompletion?: () => void,
	options?: firestore.SnapshotListenOptions
}
 ```
 `onNext` is a function that will receive the updated document.  `listen` returns a function that can be called to unsubscribe the listener from further changes.
 
 Example:
```
const targetedUser = User.findByID("Xlsdof28dkf2");
const unsubscribe = targetedUser.listen({
   onNext: (user) => console.log("The target user has changed!");
```

### `doc_ref: DocumentReference`
Underlying reference to the document in Firestore.  This field may be useful to users trying to access Firestore functionality not yet supported by RedPanda (e.g. subcollections).

### `__id__<foreignkey>: string`
Since accessing a foreign key attribute may return a promise to the document, for users that only need access to the ID, this property may be useful.

Example:
```
const employee = new Employee({ company: "Xyjdfa7a261" });  // Company is a foreign key
console.log("Company ID is ", employee.__id__company);  // Company ID is Jq8wjq018

const company = await employee.company;
console.log("Company ID is ", company.id);  // Company ID is Jq8wjq018

```

## Class Methods and Attributes
The following attributes and methods are available statically from a user defined document class.  Also see the "Querying the database" section below.

### `Document.coll_ref: CollectionReference`
Underlying reference to the collection in Firestore.  This field may be useful to users trying to access Firestore functionality not yet supported by RedPanda.


## Querying the database
The following methods are provided statically from the document class.
To find an object by an ID, use the static method `findByID`.
### `findByID(id: string, options: {populate?: string[], populateAll?: boolean})`
Returns the document corresponding to the given ID.  Returns `null` if no such document is found in the collection.
The options can be used to automatically populate any foreign keys/references to documents in other collections.  `populate` takes an array of fields to populate; it can also populate nested foreign references using the dot notation.  If `populateAll` is specified, then all foreign fields will be populated.  If `populateAll` is true, this is done recursively; if it is false, it is only done at the very top-level non-recursively.
For more information on populating foreign keys through a $lookup and JOIN like methodology, see [Foreign Key Attributes ($lookup and JOIN)](#foreign-key-attributes-lookup-and-join).

Example:
```
const employee = await Employee.findByID('2jhsd91u2jd2h8', {
     populate: ["company", "company.ceo"]
}); // Searches the User collection for '2jhsd91u2jd2h8'

const business = await Business.findByID('9871kh1b232f'); // Searches Business collection for '9871kh1b232f'
```

### `where`, `orderBy`, `limit`, `get`,
All normal Firestore queries are supported, along with an `update` function that updates all documents found in a query with the given data.  You can populate foreign references automatically with the `populate` and `populateAll` options in `get()` (see [findByID](#findbyidid-string-options-populate-string-populateall-boolean)).
For more information on populating foreign keys through a $lookup and JOIN like methodology, see [Foreign Key Attributes ($lookup and JOIN)](#foreign-key-attributes-lookup-and-join).

Example query:
```
// Get all users born between 1980 and 2010
const queryset = await User.where("birth_year", ">=", 1980)
                           .where("birth_year", "<=", 2010)
                           .orderBy("email", "asc")
                           .limit(10)
                           .get();

// Get all users in the database and populate all foreign references
const allUsers = await User.get({ populateAll: true });
```

### `select` projection queries
Firestore has a hidden projection query operator (called a "mask") called `select` that isn't documented in the official Firebase documentation.  However, to users with the appropriate Firebase version, this functionality is available, as shown below:

Example:
```
// Retrieve first and last names of all users born after 1980
const projectionQuery = await User.where("birth_year", ">=", 1980).select("first_name", "last_name").get()
```

### `count(): Promise<int>`
Return the count of documents in the query or collection.  This functionality relies on the `select` function, so it is only available for Firebase versions with the `select` method available.

Example:
```
const totalNumberOfUsers = await User.count();
```

### `update(data: object, retrieve?: boolean)`
For any query, an update can also be run on that query with the given `data`.  If the `retrieve` flag is set, then the affected documents will be returned. Otherwise, the ids of the updated documents are returned.  `retrieve` defaults to `false`.
Example update:
```
const user = await User.findByID('192kjfd01jfds'); // Get the user of interest
// Update all businesses owned by that user to record the user's email as the business email
const updated_users = await Business.where("user", "==", user.id).limit(1000).update({
  email: user.email
}, true);
```

### `listen(context): Function`
Listens to the collection or query for document changes.  `context` is a dictionary with the form
```
{
	onNext: (docs: Document[]) => void,
	onError?: (error: Error) => void,
	onCompletion?: () => void,
	options?: firestore.SnapshotListenOptions
}
 ```
`onNext` is a function that will receive an array of documents that have been updated in the collection or query.  The returned function from `listen` can be used to unsubscribe the listener from further changes.

Example:
```
const unsubscribe = Business.where("city", "==", "Atlanta").listen({ 
   onNext: (businesses) => console.log(`${businesses.length} businesses have been changed!`);
});
```

## Subcollections
Subcollections are not supported at this time.  However, note that any functionality achieved with a subcollection can also be done by simply adding another field to a document and querying on that field.

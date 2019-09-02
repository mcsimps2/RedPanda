# Red Panda
A quick and nasty Firestore ODM


## Connecting to the Firestore database
### `RedPanda.connect(db: Firestore)`
RedPanda currently only supports one database connection at a time.


## Defining Document Classes
Start off by defining your schemas.
### `RedPanda.create(cls_name: string, schema: object, strict?: boolean, collection?: string|CollectionReference): class`
Creates a class with the given class name `cls_name` and schema `schema` to define documents for a given collection.  Documents will be instances of this new class.  `cls_name` should be the name of the collection (e.g. User, Business, etc...) unless you want to specify a collection reference manually (see below).
- `schema`: For defining schemas, Red Panda provides an extension of [joi](https://github.com/hapijs/joi) accessible via `RedPanda.types` with added support for `dbref` (foreign keys/documents) and `dbreflist` (array of foreign keys/documents). 
 - `strict`: strict mode indicates that unknown fields not defined in the `schema` object should be not be saved to the database; it is set, by default, to `false`.
 - `collection`: The collection to which document instances of `cls_name` will be saved defaults to the lower case class name (`cls_name.toLowerCase()`).  However, a `collection` name or Firestore reference may be passed in to override this.
 
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

However, you probably want to subclass this returned class to add additional methods, JSON serialization decorators, TypeScript definitions, etc...

```
import {JsonObject, JsonProperty} from 'ta-json';

class User extends UserDocument {
  @JsonProperty('email')
  email: string
  
  @JsonProperty('firstName')
  first_name: string
  
  
  @JsonProperty('lastName')
  last_name: string
  
  @JsonProperty()
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
// A Business is controlled by a user
const BusinessDocument = RedPanda.create('Business', {
    name: RedPanda.types.string().required(),
    user: RedPanda.types.dbref().collection(User).required()
});

class Business extends Business Document { ... }
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

#### Foreign Keys
When dealing with foreign keys, you may pass either an foreign ID or an foreign document as part of the data, as shown below.
```
const user = new User({
  email: 'demo_email@gmail.com',
  first_name: 'John',
  last_name: 'Doe'
});

/* OR
const user = User();
user.email = 'demo_email@gmail.com';
user.first_name = 'John';
user.last_name = 'Doe';
*/

// user must be saved first since recursive saves are not yet supported
await user.save();

const biz = new Business({
  name: 'Merry Muffins',
  user: user
});

/* OR
const biz = new Business({
  name: 'Merry Muffins',
  user: user.id
});
*/
```
The difference between the two is that, in the first case, the user will be immediately accessible via `biz.user`, but in the second case, `biz.user` returns a promise that needs to resolve in order to access the user object since only an ID was passed.

Likewise, with arrays of foreign keys:
```
const franchise = new Franchise({
  name: 'Merry Franchise',
  entities: [biz1, biz2, biz3]
})

/* OR
const franchise = new Franchise({
  name: 'Merry Franchise',
  entities: [biz1.id, biz2.id, biz3.id]
})
*/
```

## Accessing attributes
Attributes that are not references to foreign documents can be accessed normally.
```
const user = new User({ email: 'john_doe@gmail.com', first_name: 'John', last_name: 'Doe' });
await user.save();

console.log("User email is", user.email);

const full_name = user.first_name + user.last_name;
console.log("User full name is", full_name);
```

#### Foreign Key Attributes
For attributes that are references to foreign documents (or are lists of foreign documents), it is recommended you simply use the `await` keyword before accessing the attribute in dot notation, *regardless of whether or not the attribute has already been retrieved*.  

In more detail, what happens when accessing such an attribute is, if the foreign document is already available, it will be immediately returned. Otherwise, a promise will be returned.  In either case, it's advised that you use the `await` keyword when accessing any attribute corresponding to a foreign document to avoid any mishaps that could occur if you thought an attribute had already been retrieved, but it actually hadn't.  Note that using `await` on a non-Promise is OK, since `await` wraps such a value in a Promise that immediately resolves.  If the attribute is already available, then `await doc.attribute` will immediately resolve to that value; otherwise, if the attribute needs to be fetched, then `await doc.attribute` will fetch it.

To exemplify this paradigm, consider the example:
```
const business = await Business.findByID('9dkfjs82ja02jasdaow9');
// user attribute has not been retrieved, so go ahead and get it
const user =  await business.user;
console.log("User's email is", user.email);

// Now business.user has already been retrieved, but it can be accessed again in either of
// these formats with the same performance, aside from some Promise wrapping
const first_name = business.user.first_name;
const last_name = (await business.user).last_name;
console.log("User's full name is", first_name, last_name);
```

It is also valid to do the following to load any foreign documents to be readily accessed.
```
const business = await Business.findByID('9dkfjs82ja02jasdaow9');
await business.user; // Fetch business.user

// Now business.user can be accessed since it's already loaded into the object
console.log("The user's email is", business.user.email);
```

Currently, there is not yet support for automatically loading in all foreign references upon document retrieval.



## Instance Methods and Attributes
The following methods and attributes are available on all document instances.
### `id: string`
The ID of the document.  If no ID is specified in the constructor, then the `id` field is auto-generated and only present after `save()` has been called.

### `save(): ID`
Saves the document to the database and returns the ID of the document.  The document attributes will be validated against the pre-defined schema at this point and an error may be thrown if the schema is not satisfied.  If `strict` mode is on, then `save()` will silently ignore any fields not found in the schema.
Recursive saves are not yet supported, so any foreign documents must already be saved at this point.

Example:
```
const user = new User({ email: 'john_doe@gmail.com' });
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

## Querying the database
The following methods are provided statically from the document class.
To find an object by an ID, use the static method `findByID`.
### `findByID(id: string)`
Returns the document corresponding to the given ID.  Returns `null` if no such document is found in the collection.

Example:
```
const user = await User.findByID('2jhsd91u2jd2h8'); // Searches the User collection for '2jhsd91u2jd2h8'
const business = await Business.findByID('9871kh1b232f'); // Searches Business collection for '9871kh1b232f'
```

### `where`, `orderBy`, `limit`, `get`,
All normal Firestore queries are supported, along with an `update` function that updates all documents found in a query with the given data.

Example query:
```
const queryset = await User.where("birth_year", ">=", 1980)
                           .where("birth_year", "<", 2010)
                           .orderBy("email", "asc")
                           .limit(10)
                           .get();
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

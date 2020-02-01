# Red Panda
A quick and nasty Firestore ODM.

Features:
 - Built in schema validation using joi.
 - Automatically dereference foreign keys/references ($lookup and JOIN).  RedPanda will automatically translate foreign documents into references during save and dereference them when they are loaded.
 - OOP design - create model classes and extend them with attributes and methods.
 - No more clunky error handling.  Don't ever worry about `snapshot.exists` or `query.empty` again!
 - Compatible with browser and Node Firebase libraries
 - Support for projection queries and getting the count of a query
 
## API
Link to the API documentation is here: [RedPanda API](api.md)
 
## Quickstart
#### Connect to the Firestore database
```
// Connect to the Firestore database
RedPanda.connect(db);
```

#### Define your document schemas
```
// Define your schemas
const PersonDocument = RedPanda.create("Person", {
  firstName: RedPanda.types.string().required(),
  lastName: RedPanda.types.string().required()
});
class Person extends PersonDocument {...}

const Company = RedPanda.create("Company", {
  name: RedPanda.types.string().required(),
  address: RedPanda.types.string().required(),
  ceo: RedPanda.types.dbref().collection(Person).required() // Reference to the "Person" collection
});
class Company extends CompanyDocument {...}

const EmployeeDocument = RedPanda.create("Employee", {
  firstName: RedPanda.types.string().required(),
  lastName: RedPanda.types.string().required(),
  company: RedPanda.types.dbref().collection(Company).required() // Foreign key to the "Company" collection
});

// Extend the class with any additional methods
class Employee extends EmployeeDocument {
  async sendPaycheck() {
    ...
  }
}
```

#### Instantiate, save, and update documents
```
// Instantiate and save documents
const amazon = new Company({
  name: "Amazon",
  address: "410 Terry Ave. North, Seattle, WA, 98109",
  ceo: await Person.where("firstName", "==", "Jeff").where("lastName", "==", "Bezos").get()[0]
});
amazon.save();  // document ID is XiDj72kfse92

const newEmployee = new Employee({
  firstName: "John",
  lastName: "Doe",
  company: amazon 
});
newEmployee.save();
// Employee in the database is { firstName: "John", lastName: "Doe", company: "XiDj72kfse92" }

// Update documents
newEmployee.email = "john_doe@gmail.com";
await newEmployee.save();
// Alternative: await newEmployee.update({ email: john_doe@gmail.com });
```

#### Query the database and $lookup & JOIN foreign keys
```
// Query the database and populate any foreign references automatically, including nested foreign keys


const employeeQuery = await Employee.where("name", "==", "John Doe").get({ 
  populate: ["company", "company.ceo"] 
});
// Here, we asked RedPanda to go ahead and $lookup/JOIN the foreign keys Employee.company to a document in
// the "company" collection and "company.ceo" to a document in the "person" collection

for (const employee of employeeQuery) {
    console.log("The company name is ", employee.company.name);
    // "The company name is Amazon"
    console.log("The company's CEO is ", employee.company.ceo.firstName, company.ceo.lastName);
    // The company's CEO is Jeff Bezos
}

// Get documents by their ID
const specificEmployee = await Employee.findByID("A8djs7qQT");

// Populate any foreign keys you didn't already retrieve with async/await syntax
const company = await specificEmployee.company;
console.log("The company name is ", company.name)

// The company is now accessible without Promises needed
console.log("The company address is ", specificEmployee.company.address);
```

#### Listen for realtime changes
```
// Listen for realtime changes on documents, queries, and collections
specificEmployee.listen({ onNext: (employee) => console.log(employee) });
```

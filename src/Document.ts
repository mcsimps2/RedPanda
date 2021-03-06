import { firestore } from "firebase";
import _ from "lodash";
import RedPanda from "./index";
import QueryBuilder from "./QueryBuilder";

/**
 * Validates data according to a defined schema
 * @param data data to validate
 * @param options joi options
 * @param schema joi schema
 * @throws error if validation fails
 */
const validate = (data: object, options: object = {}, schema) => { // stripUnknown = false
	const joi_obj = RedPanda.types.object().keys({
		...schema
	});
	const {error, value} = RedPanda.types.validate(data, joi_obj, options);
	if (error) {
		if (error.details && error.details.length > 0) {
			throw new Error(error.details[0].message);
		} else {
			throw error;
		}
	}
	return value;
};

/**
 * Removes undefined values from an object
 * Does not remove null values
 * @param data object to sanitize
 */
const sanitize = (data: object) => {
	const sanitized = {};
	Object.keys(data).forEach((key) => {
		if (data[key] !== undefined) {
			sanitized[key] = data[key];
		}
	});
	return sanitized;
};

/**
 * Subclass Document to create a new database object
 * Setup the subclass with the static initialize method before instantiating it.
 * In the class initialization, provide the schema, as well as enable/disable strict mode (default disabled),
 * and set the collection name (optional). Turning strict mode off will allow schemaless objects.
 * Turning strict mode on will skip unknowns when pushing to from the database.
 * Does not currently skip unknowns upon pulling from the database.
 */
// TODO: enable defaults so that, if after a migration, a new field is added,
// we can default old objects to a certain value if they don't have that field
// TODO: add options, like allow unknowns on pull / ban unknowns on pull, same with push
class Document {
	[x: string]: any;
	/** Instance attributes */
	id: string;
	doc_ref: firestore.DocumentReference;
	doc_snapshot: firestore.DocumentSnapshot;
	listener_unsub: () => void;

	/** Static attributes*/
	static _coll_ref: firestore.CollectionReference = null;
	static _coll_name: string = null;
	static _schema: object = {};
	static foreign_keys: object = {}; // key is name of the field, value is a subclass of Document
	static strict: boolean = false;

	static get db() {
		return RedPanda.db;
	}

	static get coll_name(): string {
		return this._coll_name || _.snakeCase(this.name);
	}

	static set coll_name(name) {
		this._coll_name = name;
	}

	/**
	 * Sets the collection ref
	 * Probably shouldn't need to call this unless want the
	 * coll_ref to be different than the coll_name
	 */
	static set coll_ref(collection: firestore.CollectionReference) {
		this._coll_ref = collection;
	}

	static get coll_ref(): firestore.CollectionReference {
		if (this._coll_ref) {
			return this._coll_ref;
		} else {
			const ref = this.db.collection(this.coll_name);
			return ref;
		}
	}

	static set schema(schema: object) {
		this._schema = schema;
		this.foreign_keys = {};
		Object.keys(schema).forEach((key) => {
			const val = schema[key];
			this._schema[key] = val;
			if (val.describe().type === "dbref" || val.describe().type === "dbreflist") {
				if (!val.describe().rules || !val.describe().rules[0] || !val.describe().rules[0].arg.collection) {
					throw new Error("No collection class specified for field " + key);
				}
				const collection_cls = val.describe().rules[0].arg.collection;
				// Set an entry in this.foreign_keys
				// TODO: make collection references work as a pass to the schema
				if (typeof collection_cls !== "string"
					&& (!collection_cls.prototype
						|| !(collection_cls.prototype instanceof Document))) {
					// @ts-ignore
					// && !(collection_cls.prototype instanceof this.db.constructor.CollectionReference)
					throw new Error("Foreign key reference must be a subclass of Document, a CollectionReference," +
						"or a name of a collection");
				}
				this.foreign_keys[key] = collection_cls;
			}
		});
	}

	static get schema() {
		return this._schema;
	}

	/**
	 * Instantiates a new document with the given data.  If strict mode is given a concrete
	 * value (true, false, but not undefined), then that will be used instead of the class's
	 * pre-defined strict mode set in initialized.
	 * @param data the data to initialize this document with
	 * @param strict (Optional) whether extra fields are allowed beyond those defined in the schema. Overrides the class strict setting
	 * @param id (Optional) id of the document. Can be set manually or auto-generated.
	 * @param doc_ref (Optional) Reference to the document in the database
	 * @param doc_snapshot (Optional) Snapshot of the document
	 */
	constructor(data?: object)
	constructor(data?: object, id?: string)
	constructor(data?: object, id?: string, doc_ref?: firestore.DocumentReference, doc_snapshot?: firestore.DocumentSnapshot)
	constructor(data: object = {}, id: string = null, doc_ref: firestore.DocumentReference = null, doc_snapshot: firestore.DocumentSnapshot = null) {
		// @ts-ignore
		// strict = strict !== undefined ? strict : this.constructor.strict;
		// const options = strict ? { stripUnknown: true } : { allowUnknown: true, stripUnknown: false };
		// @ts-ignore
		// const subdata = this.constructor.validate(data, options);
		this.id = id;
		this.doc_ref = doc_ref;
		this.doc_snapshot = doc_snapshot;
		const proxy = this._createProxy();
		Object.assign(proxy, data);
		return proxy;
	}

	/**
	 * Creates a proxy.
	 * Based on the foreign keys of the class, sets getters and setters appropriately.
	 * Getters are such that they return a promise if the value has not been resolved before.
	 * They always resolve to a document instance.
	 * Setters can take a document subclass instance or a document ID.
	 */
	// TODO: allow lazy references)
	_createProxy() {
		// @ts-ignore
		const foreign_keys = this.constructor.foreign_keys;
		const foreign_keys_lst = Object.keys(foreign_keys);
		// @ts-ignore
		const schema = this.constructor.schema;
		// @ts-ignore
		const db = this.constructor.db;
		return new Proxy(this, {
			set(target, property, value) {
				if (foreign_keys_lst.includes(property.toString())) {
					// Can't use property in foreign_keys, b/c constructor is a prop in foreign keys
					// if (property.toString() in foreign_keys && property.toString() !== 'constructor') {
					// Is this a foreign key or foreign key list?
					if (schema[property.toString()].describe().type === "dbref") {
						if (typeof value === "string") {

							return Reflect.set(target, "__id__" + property.toString(), value)
								&& Reflect.set(target, "__obj__" + property.toString(), null);
						} else if (value instanceof Document) {
							return Reflect.set(target, "__id__" + property.toString(), value.id)
								&& Reflect.set(target, "__obj__" + property.toString(), value);
						} else if (value == null) {
							return Reflect.set(target, "__id__" + property.toString(), null)
								&& Reflect.set(target, "__obj__" + property.toString(), null);
						} else {
							throw new Error("Can only set a foreign reference with an id or Document subclass instance");
						}
					} else {
						// Check if we are all objects
						let is_all_objs = true;
						const ids = [];
						value.forEach((el) => {
							if (el instanceof Document) {
								ids.push(el.id);
							} else if (typeof el === "string") {
								is_all_objs = false;
								ids.push(el);
							} else {
								throw new Error("Can only set a foreign reference with an id or Document subclass instance");
							}
						});
						// If just array of objects
						if (is_all_objs) {
							return Reflect.set(target, "__id__" + property.toString(), ids)
								&& Reflect.set(target, "__obj__" + property.toString(), value);
						} else {
							return Reflect.set(target, "__id__" + property.toString(), ids)
								&& Reflect.set(target, "__obj__" + property.toString(), null);
						}
					}
				} else {
					return Reflect.set(target, property, value);
				}
			},
			get(target, property, receiver) {
				if (foreign_keys_lst.includes(property.toString())) {
					// Can't use property in foreign_keys, b/c constructor is a prop in foreign keys
					// if (property.toString() in foreign_keys && property.toString() !== 'constructor') {
					const curr_val = Reflect.get(target, "__obj__" + property.toString(), receiver);
					if (curr_val) {
						return curr_val;
					} else {
						if (schema[property.toString()].describe().type === "dbref") {
							const id = Reflect.get(target, "__id__" + property.toString(), receiver);
							if (id == null) {
								return null;
							}
							// Retrieve the object
							return (async () => {
								const collection_cls = foreign_keys[property.toString()];
								let new_val;
								if (collection_cls.prototype instanceof Document) {
									new_val = await collection_cls.findByID(id);
								} else if (typeof collection_cls === "string") {
									const snap = await db.collection(collection_cls).doc(id).get();
									new_val = snap.exists ? snap : null;
								} else {
									const snap = await collection_cls.doc(id).get();
									new_val = snap.exists ? snap : null;
								}
								Reflect.set(target, "__obj__" + property.toString(), new_val);
								return new_val;
							})();
						} else {
							const ids: string[] = Reflect.get(target, "__id__" + property.toString(), receiver);
							if (ids == null) {
								return null;
							}
							// Retrieve the objects
							return (async () => {
								const collection_cls = foreign_keys[property.toString()];
								let updated_ids = false;
								const new_ids = [];
								let objs: any[] = await Promise.all(ids.map(async (id, idx) => {
									let obj;
									if (collection_cls.prototype instanceof Document) {
										obj = await collection_cls.findByID(id);
									} else {
										let obj_snapshot;
										// String
										if (typeof collection_cls === "string") {
											obj_snapshot = db.collection(collection_cls).doc(id).get();
										} else {
											obj_snapshot = await collection_cls.doc(id).get();
										}

										obj = obj_snapshot.exists ? obj_snapshot : null;
									}

									if (!obj) {
										// Flag that need to remove from ids
										updated_ids = true;
										// Don't push the id since it corresponds to a null object
									} else {
										// Save the id if it works
										new_ids.push(id);
									}
									return obj;
								}));
								objs = objs.filter((obj) => obj != null);
								Reflect.set(target, "__obj__" + property.toString(), objs);
								if (updated_ids) {
									Reflect.set(target, "__id__" + property.toString(), new_ids);
								}
								return objs;
							})();
						}
					}
				} else {
					return Reflect.get(target, property, receiver);
				}
			}
		});
	}

	/**
	 * Initializes the class/subclass with schema and settings
	 * @param schema RedPanda/joi schema
	 * @param strict if true, unknown fields are sanitized out. Otherwise, they are left in
	 * @param collection Name of the collection to store in
	 */
	static initialize(schema: object, strict: boolean, collection?: string) {
		this.schema = schema;
		this.strict = strict;
		this.coll_name = collection;
	}

	/**
	 * Gets all set attributes, regardless of whether or not strict is set
	 * Strict is purely handled during validate
	 * Any references are converted to their IDs
	 * @param id whether or not to include the id
	 */
	getAttributes(): object;
	getAttributes(id: boolean): object;
	getAttributes(id = false): object {
		// Make a list of everything we need to exclude
		// Exclusion important for when strict is false
		const exclude = ["doc_ref", "doc_snapshot", "listener_unsub"];
		if (!id) {
			exclude.push("id");
		}

		// Remove all __obj__ and __id__
		// @ts-ignore
		Object.keys(this.constructor.foreign_keys).forEach((key) => {
			exclude.push("__obj__" + key);
			exclude.push("__id__" + key);
		});

		// Get the object
		const fields = _.omit(this, exclude);

		// Add in ids appropriately
		// @ts-ignore
		Object.keys(this.constructor.foreign_keys).forEach((key) => {
			if (this["__id__" + key] !== undefined) {
				fields[key] = this["__id__" + key];
			}
		});

		return sanitize(fields);
	}

	static validate(attributes: object): object;
	static validate(attributes: object, options: any): object;
	static validate(attributes: object, options?: any): object {
		if (!options) {
			options = this.strict ? { stripUnknown: true } : { allowUnknown: true, stripUnknown: false };
		} else if (options.stripUnknown === undefined && options.allowUnknown === undefined) {
			if (this.strict) {
				options.stripUnknown = true;
			} else {
				options.allowUnknown = true;
				options.stripUnknown = false;
			}
		}
		const res = validate(attributes, options, this.schema);

		return res;
	}

	validate(): object;
	validate(strict: boolean): object;
	validate(strict: boolean, data: object): object;
	validate(strict?: boolean, data?: object): object {
		const attrs = data || this.getAttributes();
		// @ts-ignore
		strict = strict !== undefined ? strict : this.constructor.strict;
		const options = strict ? { stripUnknown: true } : { allowUnknown: true, stripUnknown: false };
		// @ts-ignore
		return this.constructor.validate(attrs, options);
	}

	async update(data: object): Promise<string>;
	async update(data: object, strict: boolean): Promise<string>;
	async update(data: object, strict?: boolean): Promise<string> {
		const curr_data = this.getAttributes();
		let new_data = Object.assign({}, curr_data, data);
		const new_fields = _.difference(Object.keys(curr_data), Object.keys(new_data));
		// @ts-ignore
		new_data = this.validate(strict, new_data);
		const update = _.pick(new_data, Object.keys(data), new_fields);
		// If we passed, then we SHOULD BE ABLE TO assign without worry
		// Rollback is available just in case
		Object.assign(this, update);
		try {
			const res = await this.save(strict);
			return res;
		} catch (e) {
			// Rollback and throw up error
			Object.assign(this, curr_data);
			new_fields.forEach((field) => {
				delete this[field];
			});
			throw e;
		}
	}

	// TODO: recursive saves if a doc hasn't been created yet
	async save(): Promise<string>;
	async save(strict: boolean): Promise<string>;
	async save(strict?: boolean): Promise<string> {
		// const data = this.getAttributes();
		// Will transform any refs to ids beforehand
		// TODO: save inner refs?
		const data = this.validate(strict);
		if (this.doc_ref) {
			// Doing an update
			this.doc_ref.update(data);
			return this.id;
		} else {
			if (this.id) {
				// @ts-ignore
				await this.constructor.coll_ref.doc(this.id).set(data, { merge: true });
				// @ts-ignore
				this.doc_ref = this.constructor.coll_ref.doc(this.id);
				return this.id;
			} else {
				// @ts-ignore
				this.doc_ref = await this.constructor.coll_ref.add(data);
				this.id = this.doc_ref.id;
				return this.id;
			}
		}
	}

	public async reload(recursive = false) {
		if (!this.doc_ref) {
			throw Error("Object has not been saved to database yet");
		}
		const snapshot = await this.doc_ref.get();
		await this.reloadFromSnapshot(snapshot);

		// Reload foreign documents
		if (recursive) {
			await this.load();
		}
		return this;
	}

	private async reloadFromSnapshot(snapshot) {
		this.doc_snapshot = snapshot;
		if (!this.doc_snapshot.exists) {
			throw Error("Object does not exists in the database");
		}
		// @ts-ignore
		const new_obj = await this.constructor.fromSnapshot(snapshot);
		Object.assign(this, new_obj);
		this.id = this.doc_snapshot.id;
	}

	// Loads all foreign references, if they haven't already been loaded
	async load(recursive = true) {
		// @ts-ignore
		await Promise.all(Object.keys(this.constructor.foreign_keys).map(async (foreign_key) => {
			const foreign_ref = await this[foreign_key];
			if (recursive && foreign_ref) {
				if (Array.isArray(foreign_ref)) {
					await Promise.all(foreign_ref.map((item) => item.load(true)));
				} else {
					await foreign_ref.load(true);
				}
			}
		}));
		return this;
	}

	async populateAll(recursive = true) {
		return this.load(recursive);
	}

	async populate(fields: string[]) {
		const sortedFields = fields.sort((a, b) => a.localeCompare(b));
		const splitFields = sortedFields.map((field) => field.split("."));
		let maxFieldLength = 1;
		splitFields.forEach((field) => {
			if (field.length > maxFieldLength) {
				maxFieldLength = field.length;
			}
		});
		for (let depth = 1; depth <= maxFieldLength; depth++) {
			// Get all fields of the same depth at the same time
			const fieldsOfDepth = splitFields.filter((field) => field.length === depth);
			await Promise.all(fieldsOfDepth.map(async (field) => {
				let target = await this[field[0]];
				for (let i = 1; i < field.length; i++) {
					target = await target[field[i]];
				}
			}));
		}
		return this;
	}

	async delete() {
		if (!this.doc_ref) {
			throw Error("Object has not been saved to database yet");
		}
		await this.doc_ref.delete();
		this.doc_ref = null;
		this.doc_snapshot = null;
		const id = this.id;
		this.id = undefined;
		return id;
	}

	async getSnapshot(): Promise<firestore.DocumentSnapshot> {
		if (this.doc_snapshot) {
			return this.doc_snapshot;
		} else {
			if (!this.id) {
				throw new Error("Document has not been saved to the database");
			}
			// @ts-ignore
			const snapshot = await this.constructor.coll_ref.doc(this.id).get();
			if (!snapshot || !snapshot.exists) {
				throw new Error("Document does not exist");
			} else {
				this.doc_snapshot = snapshot;
				return snapshot;
			}
		}
	}

	getReference(): firestore.DocumentReference {
		if (this.doc_ref) {
			return this.doc_ref;
		}
		if (!this.id) {
			throw new Error("Document has not been saved to the database");
		}
		// @ts-ignore
		this.doc_ref = this.constructor.coll_ref.doc(this.id);
		return this.doc_ref;
	}

	public subscribe() {
		const ref = this.getReference();
		this.unsubscribe();
		this.listener_unsub = ref.onSnapshot(async (snapshot) => {
			if (snapshot.exists) {
				await this.reloadFromSnapshot(snapshot);
			}
		});
	}

	public unsubscribe(): boolean {
		if (this.listener_unsub) {
			this.listener_unsub();
			this.listener_unsub = null;
			return true;
		}
		return false;
	}

	public async listen(context) {
		context.document = this;
		// @ts-ignore
		return this.constructor.listen(context);
	}

	static async listen<T extends Document>(context: {
		id?: string,
		document?: T,
		onNext: (doc: T | T[]) => void,
		onError?: (error: Error) => void,
		onCompletion?: () => void,
		options?: firestore.SnapshotListenOptions
	});
	static async listen<T extends Document>(context: {
		id?: string,
		document?: T,
		onNext: (doc: T | T[]) => void,
		onError?: (error: Error) => void,
		onCompletion?: () => void,
		options?: firestore.SnapshotListenOptions
	},                                query?: QueryBuilder) {
		const { id, document, onNext, onError, onCompletion, options } = context;
		// Listening to a document
		if (id || document) {
			let ref;
			if (id) {
				ref = this.coll_ref.doc(id);
			}
			else {
				ref = document.getReference();
			}
			const nextCb = async (snapshot: firestore.DocumentSnapshot) => {
				// Can't think of a reason why the snapshot would exist at this point, but...
				if (snapshot.exists) {
					const new_obj = await this.fromSnapshot(snapshot);
					onNext(new_obj as T);
				}
			};
			if (options) {
				return ref.onSnapshot(options, nextCb, onError, onCompletion);
			}
			else {
				return ref.onSnapshot(nextCb, onError, onCompletion);
			}
		} else {
			const fs_query = query != null ? (await QueryBuilder.construct(this.coll_ref, query)) : this.coll_ref;
			const nextCb = async (querysnapshot: firestore.QuerySnapshot) => {
				const docs = await this.convertQuerySnapshot(querysnapshot);
				onNext(docs as T[]);
			};
			if (options) {
				return fs_query.onSnapshot(options, nextCb, onError, onCompletion);
			}
			else {
				return fs_query.onSnapshot(nextCb, onError, onCompletion);
			}
		}
	}

	private static async convertQuerySnapshot(querysnapshot: firestore.QuerySnapshot) {
		if (querysnapshot.empty) {
			return [];
		} else {
			const docs = (await Promise.all(querysnapshot.docs.map((snapshot) => this.fromSnapshot(snapshot)))).filter((doc) => doc != null);
			return docs;
		}
	}

	static async findByID(id: string, options?: {populate?: string[], populateAll?: boolean}) {
		const snapshot = await this.coll_ref.doc(id).get();
		const res = await this.fromSnapshot(snapshot);
		if (res && options) {
			if (options.populate != null) {
				await res.populate(options.populate);
			}
			if (options.populateAll != null) {
				await res.populateAll(options.populateAll);
			}
		}
		return res;
	}

	// TODO: resolve references (hence why it is async)
	static async fromSnapshot(snapshot: firestore.DocumentSnapshot) {
		if (!snapshot.exists) {
			return null;
		}
		const data = snapshot.data();
		// Strict is false here because we may have some unknown fields in the DB
		// that we want to populate up
		const obj = new this(data, snapshot.id, snapshot.ref, snapshot);
		return obj;
	}

	static async find(query?: string|QueryBuilder, options?: {populate?: string[], populateAll?: boolean}) {
		if (query == null || typeof query !== "string") {
			// @ts-ignore
			const fs_query = query != null ? (await QueryBuilder.construct(this.coll_ref, query)) : this.coll_ref;
			const query_snapshot = await fs_query.get();
			if (query_snapshot.empty) {
				return [];
			}
			let objs = await Promise.all(query_snapshot.docs.map(async (snap) => {
				const obj = await this.fromSnapshot(snap);
				if (obj && options) {
					if (options.populate != null) {
						await obj.populate(options.populate);
					}
					if (options.populateAll != null) {
						await obj.populateAll(options.populateAll);
					}
				}
				return obj;
			}));

			// @ts-ignore
			objs = objs.filter((obj) => obj != null);
			return objs;
		} else {
			return this.findByID(query, options);
		}
	}

	/**
	 *
	 * @param data
	 * @param retrieve Retrieve the documents after they've been updated and return them
	 * @param query if not defined, then applies update to whole collection
	 */
	static async update(data: object, retrieve?: boolean);
	static async update(data: object, retrieve = false, query?: QueryBuilder, options?: {populate?: string[], populateAll?: boolean}) {
		const fs_query = query ? (await QueryBuilder.construct(this.coll_ref, query)) : this.coll_ref;
		const query_snapshot = await fs_query.get();
		if (query_snapshot.empty) {
			return [];
		}
		// Make sure every object would pass validation
		query_snapshot.docs.map(async (snap) => {
			const curr_data = snap.data();
			const new_data = Object.assign({}, curr_data, data);
			this.validate(new_data);
		});
		// If we pass, then perform update
		const updated_ids = [];
		await Promise.all(query_snapshot.docs.map(async (snap) => {
			await snap.ref.update(data);
			updated_ids.push(snap.id);
		}));

		if (retrieve) {
			return Promise.all(updated_ids.map((id) => this.findByID(id, options)));
		} else {
			return updated_ids;
		}
	}

	/**** USE ANY OF THESE TO KICK OFF A QUERY/UPDATE ****/
	static _createQueryBuilder() {
		const qb = new QueryBuilder(this.find.bind(this), this.update.bind(this), this.listen.bind(this));
		return qb;
	}
	static where(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.where(...args);
	}

	static orderBy(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.orderBy(...args);
	}

	static limit(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.limit(...args);
	}

	static startAt(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.startAt(...args);
	}

	static endAt(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.endAt(...args);
	}

	static startAfter(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.startAfter(...args);
	}

	static endBefore(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.endBefore(...args);
	}

	static select(...args) {
		const qb = this._createQueryBuilder();
		// @ts-ignore
		return qb.select(...args);
	}

	static count() {
		const qb = this._createQueryBuilder();
		return qb.count();
	}

	static get(options?: {populate?: string[], populateAll?: boolean}) {
		return this.find(undefined, options);
	}
}

export default Document;

// static set schema(schema: object) {
//     this._schema = schema;
//     this._foreign_keys = {}
//     this._schema = {};
//     this.foreign_keys = {};
//     Object.keys(schema).forEach((key) => {
//         const val = schema[key];
//         this._schema[key] = val;
//         if (val.describe()['type'] === 'dbref') {
//             if (!val.describe().rules[0] || !val.describe().rules[0].arg['collection']) {
//                 throw new Error('No collection class specified for field ' + key);
//             }
//             const collection_cls = val.describe().rules[0].arg['collection'];
//             // Set an entry in this.foreign_keys
//             if (!collection_cls.prototype || !(collection_cls.prototype instanceof Document)) { // Class
//                 throw new Error('Foreign key reference must be a subclass of Document');
//             }
//             this.foreign_keys[key] = collection_cls

//             Object.defineProperty(this.prototype, key, {
//                 set: (foreign_ref) => {
//                     console.log("\n\n\nSETTER CALLED FOR ", key);
//                     console.log(this);
//                     // Foreign ref must either be ID or a document
//                     if (typeof foreign_ref === 'string') {
//                         this['__id__' + key] = foreign_ref;
//                         this['__obj__' + key] = null;
//                     }
//                     else if (foreign_ref instanceof Document) {
//                         this['__id__' + key] = foreign_ref.id;
//                         this['__obj__' + key] = foreign_ref;
//                     }
//                     else {
//                         throw new Error("Can only set a foreign reference with an id or Document subclass instance")
//                     }
//                 },
//                 get: () => { // TODO: look out for this binding
//                     // "this" should be bound to the instance
//                     // Returns a promise if value not yet retrieved, else the already retrieved value
//                     // Caches the value for future use
//                     // So on the first call, will need to use await
//                     // or if you aren't sure, use await
//                     console.log("GETTER CALLED");
//                     console.log(this);
//                     const curr_val = this['__obj__' + key];
//                     if (curr_val) return curr_val;
//                     else {
//                         // Retrieve the object
//                         return (async () => {
//                             //@ts-ignore
//                             const new_val = await collection_cls.findByID(this['__id__' + key]);
//                             this['__obj__' + key] = new_val;
//                             return new_val;
//                         })();
//                     }
//                 }
//             });
//         }
//     });
// }

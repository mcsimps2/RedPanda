import { firestore } from "firebase";
import Document from "./Document";

export default class QueryBuilder {
	query: Array<{operator: string, op_args: any[]}> = [];
	find_callback: Function;
	update_callback: Function;
	listen_callback: Function;

	constructor(find_callback, update_callback, listen_callback) {
		this.find_callback = find_callback;
		this.update_callback = update_callback;
		this.listen_callback = listen_callback;
		this.query = [];
	}

	where(field: string, comparator: string, value: any) {
		this.query.push({
			operator: "where",
			op_args: [field, comparator, value]
		});
		return this;
	}

	orderBy(field: string, direction: string) {
		this.query.push({
			operator: "orderBy",
			op_args: [field, direction]
		});
		return this;
	}

	limit(amnt: number) {
		this.query.push({
			operator: "limit",
			op_args: [amnt]
		});
		return this;
	}

	startAt(val: Document|firestore.FieldValue) {
		this.query.push({
			operator: "startAt",
			op_args: [val]
		});
		return this;
	}

	endAt(val: Document |firestore.FieldValue) {
		this.query.push({
			operator: "endAt",
			op_args: [val]
		});
		return this;
	}

	startAfter(val: Document|firestore.FieldValue) {
		this.query.push({
			operator: "startAfter",
			op_args: [val]
		});
		return this;
	}

	endBefore(val: Document|firestore.FieldValue) {
		this.query.push({
			operator: "endBefore",
			op_args: [val]
		});
		return this;
	}

	select(...fields: string[]) {
		this.query.push({
			operator: "select",
			op_args: fields
		});
		return this;
	}

	async get() {
		return this.find_callback(this);
	}

	async update(data: object, retrieve = false) {
		return this.update_callback(data, retrieve, this);
	}

	listen(context) {
		return this.listen_callback(context, this);
	}

	private static async applyOperator(fs_query: firestore.CollectionReference|firestore.Query, operator, op_args) {
		let val;
		if (["startAt", "startAfter", "endBefore", "endAt"].includes(operator)) {
			const arg = op_args[0];
			if (arg instanceof Document) {
				val = await arg.getSnapshot();
			}
			else {
				val = arg;
			}
		}
		switch (operator) {
			case "where":
				// @ts-ignore
				return fs_query.where(...op_args);
			case "orderBy":
				// @ts-ignore
				return fs_query.orderBy(...op_args);
			case "limit":
				// @ts-ignore
				return fs_query.limit(...op_args);
			case "startAt":
				// @ts-ignore
				return fs_query.startAt(val);
			case "startAfter":
				return fs_query.startAfter(val);
			case "endBefore":
				return fs_query.endBefore(val);
			case "endAt":
				return fs_query.endAt(val);
			case "select":
				// @ts-ignore
				return fs_query.select(...op_args);
			default:
				throw new Error("Unknown operation " + operator);
		}
	}

	public static async construct(collection: firestore.CollectionReference | firestore.Query, qb: QueryBuilder) {
		let fs_query = collection;
		for (const { operator, op_args } of qb.query) {
			fs_query = await this.applyOperator(fs_query, operator, op_args);
		}
		return fs_query;
	}
}

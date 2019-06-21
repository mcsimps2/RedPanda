import { firestore } from "firebase";

export default class QueryBuilder {
    query = {
        where: [],
        orderBy: null,
        limit: null
    }
    find_callback: Function
    update_callback: Function

    constructor(find_callback, update_callback) {
        this.find_callback = find_callback;
        this.update_callback = update_callback;
    }

    where(field: string, comparator: string, value: any) {
        this.query.where.push([
            field, comparator, value
        ]);
        return this;
    }

    orderBy(field: string, direction: string) {
        this.query.orderBy = [field, direction]
        return this;
    }

    limit(amnt: number) {
        this.query.limit = amnt;
        return this;
    }

    getWhere() {
        return this.query.where;
    }

    getOrderBy() {
        return this.query.orderBy;
    }

    getLimit() {
        return this.query.limit;
    }

    async get() {
        return this.find_callback(this);
    }

    async update(data: object, retrieve = false) {
        return this.update_callback(data, retrieve, this);
    }

    static construct(collection: firestore.CollectionReference | firestore.Query, qb: QueryBuilder) {
        let fs_query = collection;
        const wheres = qb.getWhere();
        if (wheres) {
            for (let key in wheres) {
                const where = wheres[key];
                // @ts-ignore
                fs_query = fs_query.where(...where);
            }
        }
        const orderBy = qb.getOrderBy();
        if (orderBy) {
            // @ts-ignore
            fs_query = fs_query.orderBy(...orderBy);
        }
        const limit = qb.getLimit();
        if (limit) {
            fs_query = fs_query.limit(limit);
        }
        return fs_query;
    }
}
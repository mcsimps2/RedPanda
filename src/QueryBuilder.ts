import { firestore } from "firebase";

export default class QueryBuilder {
    query = {
        where: [],
        orderBy: null,
        limit: null,
        startAt: null,
        startAfter: null,
        endAt: null,
        endBefore: null
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

    startAt(...args) {
        this.query.startAt = args;
        return this;
    }

    endAt(...args) {
        this.query.endAt = args;
        return this;
    }

    startAfter(...args) {
        this.query.startAfter = args;
        return this;
    }

    endBefore(...args) {
        this.query.endBefore = args;
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

    getStartAt() {
        return this.query.startAt;
    }

    getEndAt() {
        return this.query.endAt;
    }

    getStartAfter() {
        return this.query.startAfter;
    }

    getEndBefore() {
        return this.query.endBefore;
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
        const startAt = qb.getStartAt();
        if (startAt) {
            fs_query = fs_query.startAt(...startAt);
        }
        const startAfter = qb.getStartAfter();
        if (startAfter) {
            fs_query = fs_query.startAfter(...startAfter);
        }
        const endBefore = qb.getEndBefore();
        if (endBefore) {
            fs_query = fs_query.endBefore(...endBefore);
        }
        const endAt = qb.getEndAt();
        if (endAt) {
            fs_query = fs_query.endAt(...endAt);
        }
        const limit = qb.getLimit();
        if (limit) {
            fs_query = fs_query.limit(limit);
        }
        return fs_query;
    }
}

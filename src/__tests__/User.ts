import RedPanda from '../'
import Animal from "./Animal";

const UserDocument = RedPanda.create('User', {
	email: RedPanda.types.string().email().required(),
	first: RedPanda.types.string(),
	last: RedPanda.types.string(),
	pets: RedPanda.types.dbreflist().collection(Animal)
}, true);

class User extends UserDocument {

}

export default User;

import RedPanda from '../'

const UserDocument = RedPanda.create('User', {
	email: RedPanda.types.string().email().required(),
	first: RedPanda.types.string(),
	last: RedPanda.types.string()
}, true);

class User extends UserDocument {

}

export default User

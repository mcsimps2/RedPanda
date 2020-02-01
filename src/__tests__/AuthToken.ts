import RedPanda from '../'

const AuthTokenDocument = RedPanda.create('Animal', {
	jti: RedPanda.types.string().required()
}, true);

class AuthToken extends AuthTokenDocument {

}

export default AuthToken;

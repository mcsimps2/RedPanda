import RedPanda from '../'
import User from './User'

const BusinessDocument =  RedPanda.create('Business', {
	name: RedPanda.types.string().required(),
	user: RedPanda.types.dbref().collection(User).required()
});

class Business extends BusinessDocument {
	user: any;
}

export default Business

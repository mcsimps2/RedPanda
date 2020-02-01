import RedPanda from '../'

const AnimalDocument = RedPanda.create('Animal', {
	species: RedPanda.types.string().required()
}, true);

class Animal extends AnimalDocument {

}

export default Animal;

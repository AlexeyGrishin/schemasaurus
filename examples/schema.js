module.exports = {
    properties: {
        firstname: {type: "string", required: true},
        lastname: {type: "string", required: true},
        gender: {type: "string", required: true, enum: ["male", "female"]},
        favouriteBooks: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: {type: "string", required: true},
                    genre: {type: "string"}
                }
            }
        }
    }
};

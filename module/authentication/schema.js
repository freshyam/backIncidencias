const authenticationSchema = `#graphql
    
    type token {
        token: String
    }

    input userLoginInput {
        usuario: String
        password: String
    }

    type Query {
        prueba: String
    }
    type Mutation {
        loginUser(input: userLoginInput) : token
        
    }
`
export default authenticationSchema
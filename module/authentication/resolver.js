import connection from "../../Config/connectionSQL.js";
import jsonwebtoken from "jsonwebtoken";
import { GraphQLError } from "graphql";
import "dotenv/config";

const createToken = (user, secret, expiresIn) => {
    const {id, nombre} = user;
    return jsonwebtoken.sign( { id, nombre}, secret,{ expiresIn });
}

const authenticationResolver = {
    Query : {
        prueba: (_,{}) => {
            return "Hola pa";
        }
    },
    Mutation : {
        loginUser: async(_,{input}) => {
            try {
                const [user] = await connection.query(
                    `   SELECT id, CONCAT(nombre,' ', aPaterno) AS nombre, usuario, password FROM usuarios WHERE usuario = ? AND password = ? 
                    `,[input.usuario, input.password]
                );

                if(user.length > 0){
                    return {
                        token: createToken(user[0], process.env.SECRETA, '24H')
                    };
                }else{
                    return {token: ""};
                }
                
            } catch (error) {
                console.log(error);

                throw new GraphQLError("Error al iniciar sesión", {
                    extensions: {
                        code: "BAD_REQUEST",
                        http: { status: 400 },
                        originalError: error.message,
                    }
                });
            }

        },
        
    }
};

export default authenticationResolver;

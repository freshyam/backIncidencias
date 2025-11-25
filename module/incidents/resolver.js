import connection from "../../Config/connectionSQL.js";
import { GraphQLError } from "graphql";

const incidentsResolver = {
  Query: {
    GetIncidents: async () => {
      try {
        const [incidents] = await connection.query(
          `
          SELECT
            i.id,
            i.titulo,
            i.descripcion,
            i.reporta,
            i.prioridad,
            i.status,
            DATE_FORMAT(i.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
            i.idusuario AS idAgente,
            u.nombre AS agente
          FROM incidentes AS i
          INNER JOIN usuarios AS u
            ON u.id = i.idusuario
          ORDER BY i.id DESC;
          `
        );

        return incidents;
      } catch (error) {
        console.log(error);
        throw new GraphQLError("Error al obtener incidencias.", {
          extensions: {
            code: "BAD_REQUEST",
            http: { status: 400 },
          },
        });
      }
    },
  },

  Mutation: {
    CreateIncident: async (_, { input }, ctx) => {
      try {
        if (!ctx.usuario) {
          throw new GraphQLError("No autorizado", {
            extensions: {
              code: "UNAUTHORIZED",
              http: { status: 401 },
            },
          });
        }

        const idUsuario = ctx.usuario.idUsuario ?? ctx.usuario.id;

        if (!idUsuario) {
          throw new GraphQLError(
            "No se encontró el id del usuario en el token",
            {
              extensions: {
                code: "UNAUTHORIZED",
                http: { status: 401 },
              },
            }
          );
        }

        const [insertResult] = await connection.query(
          `
          INSERT INTO incidentes
              (titulo, descripcion, reporta, prioridad, status, fecha, idusuario)
          VALUES (?, ?, ?, ?, 1, NOW(), ?)
          `,
          [
            input.titulo,
            input.descripcion,
            input.reporta,
            input.prioridad,
            idUsuario,
          ]
        );

        const [rows] = await connection.query(
          `
          SELECT
            i.id,
            i.titulo,
            i.descripcion,
            i.reporta,
            i.prioridad,
            i.status,
            DATE_FORMAT(i.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
            i.idusuario AS idAgente,
            u.nombre AS agente
          FROM incidentes AS i
          INNER JOIN usuarios AS u
            ON u.id = i.idusuario
          WHERE i.id = ?
          `,
          [insertResult.insertId]
        );

        if (rows.length === 0) {
          throw new GraphQLError(
            "No se pudo obtener el incidente recién creado.",
            {
              extensions: {
                code: "INTERNAL_SERVER_ERROR",
                http: { status: 500 },
              },
            }
          );
        }

        return rows[0];
      } catch (error) {
        console.error("Error al crear incidente:", error);
        throw new GraphQLError("Error al crear incidente.", {
          extensions: {
            code: "BAD_REQUEST",
            http: { status: 400 },
          },
        });
      }
    },

    UpdateIncidentStatus: async (_, { id, status }, ctx) => {
      try {
        // si quieres exigir login, descomenta:
        // if (!ctx.usuario) {
        //   throw new GraphQLError("No autorizado", {
        //     extensions: {
        //       code: "UNAUTHORIZED",
        //       http: { status: 401 },
        //     },
        //   });
        // }

        const [updateResult] = await connection.query(
          "UPDATE incidentes SET status = ? WHERE id = ?",
          [status, id]
        );

        if (updateResult.affectedRows === 0) {
          throw new GraphQLError("Incidente no encontrado.", {
            extensions: {
              code: "NOT_FOUND",
              http: { status: 404 },
            },
          });
        }

        const [rows] = await connection.query(
          `
          SELECT
            i.id,
            i.titulo,
            i.descripcion,
            i.reporta,
            i.prioridad,
            i.status,
            DATE_FORMAT(i.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
            i.idusuario AS idAgente,
            u.nombre AS agente
          FROM incidentes i
          INNER JOIN usuarios u ON u.id = i.idusuario
          WHERE i.id = ?
          `,
          [id]
        );

        if (rows.length === 0) {
          throw new GraphQLError(
            "No se pudo obtener el incidente actualizado.",
            {
              extensions: {
                code: "INTERNAL_SERVER_ERROR",
                http: { status: 500 },
              },
            }
          );
        }

        return rows[0];
      } catch (error) {
        console.error("Error al actualizar estado de incidente:", error);
        throw new GraphQLError("Error al actualizar estado de incidente.", {
          extensions: {
            code: "BAD_REQUEST",
            http: { status: 400 },
          },
        });
      }
    },
  },
};

export default incidentsResolver;

import connection from "../../Config/connectionSQL.js";
import { GraphQLError } from "graphql";
import mazatlanHora from "../../functions/MazatlanHora.js";


const routedResolver = {
    Query: {
        getCobradores: async () => {
            try {
                const [Cobradores] = await connection.query(`
                    SELECT idUsuario, nombre, aPaterno, aMaterno,celular FROM usuarios WHERE tipo = 3;
                `);
                return Cobradores;
            } catch (error) {
                console.error(error);
                throw new GraphQLError("Error al obtener el Cobrador.", {
                    extensions: { code: "BAD_REQUEST", http: { status: 400 } },
                });
            }
        },
        getClientesSinAsignar: async () => {
        try {
            const [rows] = await connection.query(`
            SELECT 
                c.idCliente,
                CONCAT(c.nombre, ' ', c.aPaterno, ' ', c.aMaterno)    AS nombreCliente,
                CONCAT(' ', col.nombre, ' calle ', c.calle, ' num: ', c.numero_ext) AS direccion,
                m.nombre                                              AS municipio
            FROM clientes c
            JOIN municipios m ON c.municipio = m.idMunicipio
            JOIN colonias   col ON col.idColonia = c.colonia
            WHERE
                EXISTS (
                SELECT 1
                FROM ventas v
                WHERE v.idCliente = c.idCliente
                    AND v.status = 1
                )
                AND NOT EXISTS (
                SELECT 1
                FROM asignacion_rutas ar
                WHERE ar.idCliente = c.idCliente
                    AND ar.status = 1
                )
            ORDER BY c.idCliente
            `);
            return rows;
        } catch (error) {
            console.error(error);
            throw new GraphQLError("Error al obtener clientes sin cobrador.", {
            extensions: { code: "BAD_REQUEST", http: { status: 400 } },
            });
        }
        },
      getRutas: async (_, { idCobrador }) => {
            try {
               
                const hoy = mazatlanHora().slice(0,10);

                const [rows] = await connection.query(
                `
                SELECT 
                    r.idCobrador,
                    u.nombre AS nombreCobrador,
                    r.idRuta,
                    ar.nombre AS nombreRuta,
                    c.idCliente,
                    CONCAT(c.nombre, ' ', c.aPaterno, ' ', c.aMaterno) AS nombreCliente,
                    CONCAT('COLONIA: ', col.nombre, ' CALLE: ', c.calle, ' NUM: ', c.numero_ext) AS direccion,
                    m.nombre AS municipio,
                    c.celular,
                    c.distinguido,

                    (SELECT COUNT(*)
                    FROM abonos_programados ap
                    WHERE ap.idCliente = ar.idCliente
                        AND ap.pagado = 0
                        AND ap.status = 1
                        AND ap.fecha_programada < ?) AS abonos_atrasados,

                    (SELECT COUNT(*)
                    FROM abonos_programados ap
                    WHERE ap.idCliente = ar.idCliente
                        AND ap.pagado = 0
                        AND ap.status = 1
                        AND ap.fecha_programada <= LAST_DAY(?)
                        AND ap.fecha_programada >= DATE_FORMAT(?, '%Y-%m-01')) AS num_pendientes,

                    (SELECT COUNT(*)
                    FROM abonos a
                    WHERE a.status = 1
                        AND a.tipo = 1
                        AND WEEK(a.fecha_reg, 0) = WEEK(?, 0)
                        AND YEAR(a.fecha_reg) = YEAR(?)
                        AND a.idVenta IN (
                            SELECT v2.idVenta
                            FROM ventas v2
                            WHERE v2.idCliente = ar.idCliente
                            AND v2.status = 1
                        )) AS num_abonos

                FROM (
                    SELECT DISTINCT idCobrador, idRuta
                    FROM asignacion_rutas
                    WHERE idCobrador = ? AND status = 1
                ) r
                JOIN usuarios u
                    ON u.idUsuario = r.idCobrador
                LEFT JOIN asignacion_rutas ar
                    ON ar.idCobrador = r.idCobrador
                AND ar.idRuta     = r.idRuta
                AND ar.idCliente IS NOT NULL
                AND ar.status     = 1
                LEFT JOIN clientes c
                    ON c.idCliente = ar.idCliente
                LEFT JOIN colonias col
                    ON col.idColonia = c.colonia
                LEFT JOIN municipios m
                    ON m.idMunicipio = c.municipio
                WHERE 
                    c.idCliente IS NULL
                    OR EXISTS (
                    SELECT 1
                    FROM ventas v
                    WHERE v.idCliente = c.idCliente
                        AND v.status = 1
                    )
                ORDER BY r.idRuta, c.nombre, c.aPaterno, c.aMaterno;
                `,
                [hoy, hoy, hoy, hoy, hoy, idCobrador]
                );

                if (rows.length === 0) return [];

                const rutas = new Map();
                for (const row of rows) {
                if (!rutas.has(row.idRuta)) {
                    rutas.set(row.idRuta, {
                    idRuta: row.idRuta,
                    idCobrador: row.idCobrador,
                    nombreRuta: row.nombreRuta,
                    name: `Ruta ${row.idRuta} de ${row.nombreCobrador}`,
                    description: "Clientes asignados",
                    color: "#3b82f6",
                    clientes: [],
                    });
                }
                if (row.idCliente) {
                    rutas.get(row.idRuta).clientes.push({
                    idCliente: row.idCliente,
                    nombreCliente: row.nombreCliente,
                    direccion: row.direccion,
                    municipio: row.municipio,
                    celular: row.celular,
                    distinguido: row.distinguido,
                    abonos_atrasados: Number(row.abonos_atrasados) || 0,
                    num_pendientes: Number(row.num_pendientes) || 0,
                    num_abonos: Number(row.num_abonos) || 0,
                    });
                }
                }

                return Array.from(rutas.values());
            } catch (error) {
                console.error(error);
                throw new GraphQLError("Error al obtener las rutas.", {
                extensions: { code: "INTERNAL_SERVER_ERROR" },
                });
            }
            }
            ,
        getTotalesClientesAsignados: async () => {
        try {
            const [rows] = await connection.query(
            `
                SELECT ar.idCobrador, COUNT(ar.id) AS total_clientes
                 FROM asignacion_rutas ar WHERE ar.status = 1 AND ar.idCliente IN (SELECT v.idCliente FROM ventas v WHERE v.status = 1) GROUP BY ar.idCobrador
            `
            );
            
            return rows.map(r => ({
            idCobrador: String(r.idCobrador),
            total_clientes: Number(r.total_clientes) || 0,
            }));
        } catch (err) {
            console.error("getTotalesClientesAsignados error:", err);
            throw new GraphQLError("Error al obtener totales por cobrador");
        }
        },
        getClientesByCobrador: async (_, { nombre, colonia }, ctx) => {
            try {
                const condicionNombre = nombre
                ? `AND CONCAT(c.nombre, " ", c.aPaterno, " ", c.aMaterno) LIKE ?`
                : "";

                const condicionColonia = colonia !== 0 ? `AND c.colonia = ${colonia}` : ""

                const query = `
                    SELECT 
                        c.idCliente, c.distinguido,
                        CONCAT(c.nombre, " ", c.aPaterno, " ", c.aMaterno) AS nombreCliente, 
                        CONCAT(m.nombre, ", ", col.nombre, ", ", c.calle, " #", c.numero_ext) AS direccion,
                        (SELECT COUNT(*) FROM abonos_programados ap
                            WHERE ap.idCliente = ar.idCliente
                            AND ap.pagado = 0
                            AND ap.status = 1
                            AND ap.fecha_programada < ?) AS abonos_atrasados,
                        (SELECT COUNT(*) FROM abonos_programados ap
                            WHERE ap.idCliente = ar.idCliente
                            AND ap.pagado = 0
                            AND ap.status = 1
                            AND ap.fecha_programada <= LAST_DAY(?) AND ap.fecha_programada >= ?) AS num_pendientes,
                        (SELECT COUNT(*)
                            FROM abonos a
                            WHERE a.status = 1
                                AND a.tipo = 1
                                AND WEEK(a.fecha_reg, 0) = WEEK(?, 0)
                                AND YEAR(a.fecha_reg) = YEAR(?)
                                AND a.idVenta IN (
                                SELECT v2.idVenta
                                    FROM ventas v2
                                    WHERE v2.idCliente = ar.idCliente
                                    AND v2.status = 1
                                )
                            ) AS num_abonos,
                        MIN(ar.orden) AS orden
                        FROM asignacion_rutas ar
                        INNER JOIN clientes c ON ar.idCliente = c.idCliente
                        INNER JOIN ventas v ON v.idCliente = c.idCliente AND v.status = 1
                        INNER JOIN municipios m ON c.municipio = m.idMunicipio
                        INNER JOIN colonias col ON c.colonia = col.idColonia
                        WHERE ar.idCobrador = ? AND ar.status = 1
                        ${condicionColonia}
                        ${condicionNombre}
                        GROUP BY ar.idCliente ORDER BY orden ASC
                `;

                const parametros = [mazatlanHora(),mazatlanHora(),mazatlanHora(),mazatlanHora(),mazatlanHora(),ctx.usuario.idUsuario];
                if (nombre) parametros.push(`%${nombre}%`);

                const [clientes] = await connection.query(query, parametros);

                return clientes;
            } catch (error) {
                console.log(error);
                return [];
            }
        },
        getColoniasAsignadas: async (_, { }, ctx) => {
            try {

                const [colonias] = await connection.query(
                    `
                        SELECT DISTINCT c.colonia, CONCAT(col.nombre, " (", mun.nombre, ")") AS nombre
                            FROM asignacion_rutas ar 
                            INNER JOIN clientes c ON ar.idCliente = c.idCliente
                            INNER JOIN colonias col ON c.colonia = col.idColonia
                            INNER JOIN municipios mun ON col.idMunicipio = mun.idMunicipio
                            WHERE ar.idCobrador = ? AND ar.status = 1 ORDER BY nombre ASC
                    `, [ctx.usuario.idUsuario]
                );
                

                return colonias;
            } catch (error) {
                console.log(error);
                throw new GraphQLError("Error obteniendo colonias.",{
                    extensions:{
                        code: "BAD_REQUEST",
                        http: {
                            "status" : 400
                        }
                    }
                });
            }
        },
        getClienteDescarga: async (_, { }, ctx) => {
            try {

                const [clientes] = await connection.query(
                    `
                        SELECT 
                            c.idCliente, c.distinguido,
                            CONCAT(c.nombre, " ", c.aPaterno, " ", c.aMaterno) AS nombreCliente, 
                            CONCAT(m.nombre, ", ", col.nombre, ", ", c.calle, " #", c.numero_ext) AS direccion,
                            m.nombre AS municipio, col.nombre AS colonia, c.celular, c.img_domicilio, c.descripcion,
                            (SELECT COUNT(*) FROM abonos_programados ap
                                WHERE ap.idCliente = ar.idCliente
                                AND ap.pagado = 0
                                AND ap.status = 1
                                AND ap.fecha_programada < CURDATE()) AS abonos_atrasados,
                            (SELECT COUNT(*) FROM abonos_programados ap
                                WHERE ap.idCliente = ar.idCliente
                                AND ap.pagado = 0
                                AND ap.status = 1
                                AND ap.fecha_programada <= LAST_DAY(CURDATE()) AND ap.fecha_programada >= CURDATE()) AS num_pendientes,
                            (SELECT COUNT(*)
                                FROM abonos a
                                WHERE a.status = 1
                                AND a.tipo = 1
                                AND WEEK(a.fecha_reg, 0) = WEEK(CURDATE(), 0)
                                AND YEAR(a.fecha_reg) = YEAR(CURDATE())
                                AND a.idVenta IN (
                                SELECT v2.idVenta
                                    FROM ventas v2
                                    WHERE v2.idCliente = ar.idCliente
                                    AND v2.status = 1
                                )
                                ) AS num_abonos,
                            MIN(ar.orden) AS orden
                            FROM asignacion_rutas ar
                            INNER JOIN clientes c ON ar.idCliente = c.idCliente
                            INNER JOIN ventas v ON v.idCliente = c.idCliente AND v.status = 1
                            INNER JOIN municipios m ON c.municipio = m.idMunicipio
                            INNER JOIN colonias col ON c.colonia = col.idColonia
                            WHERE ar.idCobrador = ? AND ar.status = 1

                            GROUP BY ar.idCliente ORDER BY orden ASC
                    `, [ctx.usuario.idUsuario]
                );
                

                return clientes;
            } catch (error) {
                console.log(error);
                throw new GraphQLError("Error obteniendo clientes.",{
                    extensions:{
                        code: "BAD_REQUEST",
                        http: {
                            "status" : 400
                        }
                    }
                });
            }
        },
    },

    Mutation: {
           asignarClienteARuta: async (_,{ input }) => {
                const { idCobrador, idRuta, idCliente } = input;
                const conn = connection;

                try {
                 
                    const [vta] = await conn.query(
                    `SELECT 1 FROM ventas WHERE idCliente=? AND status=1 LIMIT 1`,
                    [idCliente]
                    );
                    if (vta.length === 0) {
                    throw new GraphQLError("El cliente no tiene venta activa.", {
                        extensions: { code: "BAD_USER_INPUT" },
                    });
                    }

                    const [dup] = await conn.query(
                    `SELECT 1
                        FROM asignacion_rutas
                        WHERE idCobrador=? AND idRuta=? AND idCliente=? AND status=1
                        LIMIT 1`,
                    [idCobrador, idRuta, idCliente]
                    );
                    if (dup.length > 0) return true;

                    if (conn.beginTransaction) await conn.beginTransaction();

            
                    const [cabRows] = await conn.query(
                    `
                    SELECT id, nombre
                        FROM asignacion_rutas
                    WHERE idCobrador=? AND idRuta=? AND status=1 AND idCliente IS NULL
                    ORDER BY id ASC
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [idCobrador, idRuta]
                    );

                    if (cabRows.length) {
                    
                    const cab = cabRows[0];
                    await conn.query(
                        `UPDATE asignacion_rutas
                            SET idCliente = ?, orden = 0
                        WHERE id = ? AND status = 1
                        LIMIT 1`,
                        [idCliente, cab.id]
                    );
                    } else {
                   
                    const [[nm]] = await conn.query(
                        `SELECT MAX(nombre) AS nombreRuta
                        FROM asignacion_rutas
                        WHERE idCobrador=? AND idRuta=? AND status=1`,
                        [idCobrador, idRuta]
                    );
                    const nombreRuta = nm?.nombreRuta || `Ruta ${idRuta}`;

                    await conn.query(
                        `INSERT INTO asignacion_rutas (idCobrador, idRuta, idCliente, nombre, status, orden)
                        VALUES (?, ?, ?, ?, 1, 0)`,
                        [idCobrador, idRuta, idCliente, nombreRuta]
                    );
                    }

                    if (conn.commit) await conn.commit();
                    return true;
                } catch (error) {
                    if (conn.rollback) await conn.rollback();
                    console.error("Error al asignar cliente a la ruta:", {
                    message: error.message,
                    code: error.code,
                    sql: error.sqlMessage,
                    });
                    throw new GraphQLError("Error al asignar cliente a la ruta.", {
                    extensions: { code: "INTERNAL_SERVER_ERROR" },
                    });
                }
                },
        eliminarClienteDeRuta: async (_,{ input }) => {

                const { idCobrador, idRuta, idCliente } = input;
                const conn = connection;

                try {
                    if (conn.beginTransaction) await conn.beginTransaction();

                    const [upd] = await conn.query(
                    `
                    UPDATE asignacion_rutas
                        SET status = 0
                    WHERE idCobrador = ? AND idRuta = ? AND idCliente = ? AND status = 1
                    LIMIT 1
                    `,
                    [idCobrador, idRuta, idCliente]
                    );

                    if (upd.affectedRows === 0) {
                   
                    const [chk] = await conn.query(
                        `
                        SELECT status
                        FROM asignacion_rutas
                        WHERE idCobrador = ? AND idRuta = ? AND idCliente = ?
                        LIMIT 1
                        `,
                        [idCobrador, idRuta, idCliente]
                    );

                 
                    if (chk.length === 0 || Number(chk[0].status) === 0) {
                        
                    } else {
                        
                    }
                    }

                    const [activos] = await conn.query(
                    `
                    SELECT 1
                        FROM asignacion_rutas
                    WHERE idCobrador = ? AND idRuta = ? AND idCliente IS NOT NULL AND status = 1
                    LIMIT 1
                    `,
                    [idCobrador, idRuta]
                    );

                    if (activos.length === 0) {
                    await conn.query(
                        `
                        UPDATE asignacion_rutas
                        SET status = 0
                        WHERE idCobrador = ? AND idRuta = ? AND idCliente IS NULL AND status = 1
                        LIMIT 1
                        `,
                        [idCobrador, idRuta]
                    );
                    }

                    if (conn.commit) await conn.commit();
                    return true;
                } catch (error) {
                    if (conn.rollback) await conn.rollback();
                    console.error("Error al eliminar cliente de ruta:", {
                    message: error.message,
                    code: error.code,
                    sql: error.sqlMessage,
                    });
                    throw new GraphQLError("Error interno al eliminar la asignación.", {
                    extensions: { code: "INTERNAL_SERVER_ERROR" },
                    });
                }
                },
        crearRuta: async (_, { input }) => {
                const { idCobrador, nombreRuta } = input;
                    try {
                        const [maxRes] = await connection.query(
                        `SELECT COALESCE(MAX(idRuta), 0) AS maxRuta
                        FROM asignacion_rutas
                        WHERE idCobrador = ?`,
                        [idCobrador]
                        );
                        const nuevoIdRuta = (maxRes[0]?.maxRuta || 0) + 1;

            
                        const [ins] = await connection.query(
                        `INSERT INTO asignacion_rutas (idRuta, idCobrador,nombre, idCliente, status)
                        VALUES (?, ?, ?,NULL, 1)`,
                        [nuevoIdRuta, idCobrador, nombreRuta]
                        );

                        return {
                        success: ins.affectedRows > 0,
                        message: "Ruta creada exitosamente",
                        idRuta: nuevoIdRuta,
                        };
                    } catch (error) {
                        console.error("Error al crear la ruta:", error);
                        throw new GraphQLError("Error al crear la ruta.", {
                        extensions: { code: "INTERNAL_SERVER_ERROR" },
                        });
                    }
             },
        actualizarEnrutado: async (_, { input }, ctx ) => {
            try {

                const { ids } = input;

                for(const item of ids){
                
                    const [actualizarEnrutado] = await connection.execute(
                        `UPDATE asignacion_rutas SET orden = ? WHERE idCliente = ? AND status = 1 AND idCobrador = ?; `,
                        [item.orden, item.idCliente, ctx.usuario.idUsuario]
                    );

                }

                return "Enrutado actualizado.";
            } catch (error) {

                throw new GraphQLError("Error actualizando enrutado.",{
                    extensions:{
                        code: "BAD_REQUEST",
                        http: {
                            "status" : 400
                        }
                    }
                });
                
            }
        }
    },
};

export default routedResolver;

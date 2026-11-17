# MikhuFi

MVP web de ahorro gamificado inspirado en fauna boliviana. Cada animal representa una inversión independiente con su propio monto, plazo, rendimiento estimado y fecha de vencimiento.

## Flujo del MVP

1. Registro con correo y nickname.
2. Creación automática de una wallet Stellar de prueba.
3. Activación automática de 200 USDC simulados, sin pedir un monto al usuario.
4. Comparación de 1, 3, 6 y 12 meses usando 50 USDC como ejemplo visual.
5. Elección de un Jukumari o una Llama incluidos, o un Gato Ticayo premium por 3 USDC simulados.
6. Cuidado gratuito del animal mientras avanza la inversión.
7. Retiro del capital más el rendimiento estimado cuando vence el plazo.

## Modelo de producto

- Un animal equivale a una inversión.
- Crear otra inversión crea otro animal; no modifica las anteriores.
- Los plazos del MVP usan APY estimado de 4%, 5%, 6% y 7%.
- Las cinco etapas de vida dependen del avance proporcional de cada plazo.
- La comida proviene de la huerta y nunca descuenta USDC.
- Tras siete días sin alimento, el animal pasa al memorial.
- La muerte del animal nunca reduce ni elimina el capital.
- Revivir es opcional y cuesta entre 0.10 y 1 USDC, pagados desde el saldo disponible.
- El retiro anticipado no está habilitado en este MVP.
- Al vencimiento se puede retirar capital más rendimiento estimado.
- Las tasas son datos simulados del prototipo, no una promesa de rendimiento.

## Funciones

- Varias inversiones y animales simultáneos.
- Jukumari y Llama incluidos.
- Gato Ticayo premium.
- Wallet, cargas y saldos simulados.
- Alimentación, exploración, salud, cinco etapas y memorial.
- Persistencia local en el navegador.
- Identidad visual propia, logo y tres hábitats vectoriales animados.
- Bosque nublado para el Jukumari, altiplano para la Llama y valle rocoso para el Ticayo.
- Interfaz responsive que cambia de atmósfera según el animal seleccionado.
- Sin Pollar, Trustless Work ni movimientos reales de dinero.

## Ejecutar

Requiere Node.js 18 o superior.

~~~bash
git clone https://github.com/ManuelElias1999/MikhuFi.git
cd MikhuFi
npm install
npm run dev
~~~

Abre [http://localhost:4173](http://localhost:4173).

## Verificar

~~~bash
npm run check
npm test
~~~

## Siguiente fase

La autenticación real, wallet custodial o embebida, contratos, fuentes de rendimiento y pagos en Stellar se integrarán después de validar esta experiencia de producto.

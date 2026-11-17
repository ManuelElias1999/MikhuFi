# MikhuFi

MVP web de ahorro gamificado inspirado en fauna boliviana. Cada animal representa una inversión independiente con su propio monto, plazo, rendimiento estimado y fecha de vencimiento.

## Flujo del MVP

1. Dashboard público con explicación del producto y acceso al registro.
2. Registro con correo y nickname; la wallet Stellar de prueba se crea en segundo plano.
3. El usuario escribe cualquier monto desde 10 USDC y compara 1, 3, 6 y 12 meses.
4. Elección de Jukumari, Llama o Gato Ticayo premium por 3 USDC simulados.
5. Pantalla de depósito con monto exacto, dirección Stellar, QR y botón de copia.
6. Confirmación simulada del pago y desbloqueo del dashboard de cuidado.
7. Alimentación, exploración, avance diario y seguimiento de cada meta.
8. Retiro del capital más el rendimiento estimado cuando vence el plazo.

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
- Portada fintech y dashboard inspirados en productos de ahorro gamificado, con identidad propia.
- Proceso guiado de cuatro pasos: cuenta, plan, animal y depósito.
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

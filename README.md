# MikhuFi

MVP web de ahorro gamificado inspirado en fauna boliviana. El usuario crea una cuenta, recibe una wallet, carga fondos de prueba y acompaña a un animal durante todo su ciclo de vida.

## Flujo del MVP

1. Registro con correo y nickname.
2. Creación automática de una wallet Stellar de prueba.
3. Carga de 10, 50 o 100 USDC de prueba.
4. Elección entre un compañero gratuito aleatorio o el Gato Ticayo premium por 3 USDC.
5. Tutorial del primer día.
6. Activación opcional de una meta de ahorro de 30 días.
7. Rutina diaria: alimentar gratis, explorar y terminar el día.

## Funciones

- Jukumari y llama gratuitos.
- Gato Ticayo premium con descuento sobre el saldo disponible.
- Hasta seis animales activos a la vez.
- Cinco etapas: bebé, joven, adulto, maduro y anciano.
- Alimentación diaria gratuita, ánimo, salud, envejecimiento y muerte.
- Huerta que repone comida según la cantidad de mascotas.
- Memorial para los animales fallecidos.
- Wallet, saldo, cargas y meta de ahorro para validar el flujo.
- Persistencia local en el navegador.
- Interfaz responsive con ilustraciones propias.
- Sin Pollar, Trustless Work ni movimientos reales de dinero.

## Ejecutar

Requiere Node.js 18 o superior.

```bash
git clone https://github.com/ManuelElias1999/MikhuFi.git
cd MikhuFi
npm run dev
```

Abre [http://localhost:4173](http://localhost:4173).

## Verificar

```bash
npm run check
npm test
```

## Nota

Esta versión valida la experiencia de producto y todavía no procesa dinero real. La autenticación, wallet real, contratos y pagos en Stellar corresponden a la siguiente fase.

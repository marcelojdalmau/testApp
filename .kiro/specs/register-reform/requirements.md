# Requirements Document

## Introduction

Esta reforma simplifica el flujo de registro de la aplicación frontend Angular Sport (`Sport_fe`). Actualmente, el registro exige `email`, `password`, `full_name` (nombre) y `tenant_id`, según lo definido en el spec `auth-backend-integration`. Esta reforma reduce el formulario de registro a lo mínimo: el usuario solo aporta su correo y su contraseña (más la confirmación de contraseña según las convenciones existentes). El nombre, el club y cualquier otro dato de perfil dejan de solicitarse durante el registro.

La razón es que el perfil del usuario es amplio y complejo (ver el modelo en `src/app/core/models/user-profile-dto.model.ts`, definido por el spec `user-profile-dtos`). En lugar de pedir toda esa información al registrarse, la persona completará su perfil por separado, después de crear la cuenta.

Como consecuencia, el flujo posterior al inicio de sesión cambia: tras autenticarse, el Frontend obtiene el perfil del usuario y determina si el perfil está completo. "Completo" no significa que todos los campos estén rellenos al 100%, sino que los campos requeridos (required) del perfil están presentes. Si el perfil está completo, el usuario continúa al feed. Si no lo está, el usuario es dirigido al flujo de completar perfil.

Existe un punto de diseño abierto sobre quién es la fuente de verdad de la completitud: lo más probable es que el backend decida cuándo un perfil está completo (idealmente devolviendo una bandera de completitud), aunque el Frontend también puede derivar la completitud a partir de los campos requeridos del perfil. Los requisitos de este documento cubren ambas opciones: preferir la señal del backend cuando exista y, en su ausencia, aplicar un cálculo de respaldo en el Frontend basado en los campos requeridos. La elección de la fuente de verdad definitiva se resuelve en la fase de diseño.

El alcance se limita al Frontend: la reforma del formulario/componente de registro, el enrutamiento posterior al inicio de sesión según la completitud del perfil, y la definición del chequeo de completitud. Este documento no define comportamiento nuevo del backend ni el contenido del formulario de completar perfil en sí; se mantiene consistente con el manejo de inicio de sesión y tokens ya definido en `auth-backend-integration`.

## Glossary

- **Frontend**: La aplicación frontend Angular Sport ubicada en `Sport_fe`.
- **AuthService**: El servicio Angular (`src/app/core/services/auth.service.ts`) responsable de emitir las peticiones HTTP de autenticación y gestionar el estado de autenticación.
- **RegisterPage**: El componente de la página de registro (`src/app/features/auth/register/register.component.ts`).
- **LoginPage**: El componente de la página de inicio de sesión (`src/app/features/auth/login/login.component.ts`).
- **Register_Endpoint**: El endpoint de backend `POST /auth/register`.
- **Login_Endpoint**: El endpoint de backend `POST /auth/login`.
- **Profile_Endpoint**: El endpoint de backend que el Frontend consulta tras el inicio de sesión para obtener el perfil del usuario autenticado.
- **UserProfileDto**: El modelo de datos del perfil de usuario definido en `src/app/core/models/user-profile-dto.model.ts` (spec `user-profile-dtos`).
- **Profile_Completeness_Flag**: Una bandera de completitud provista por el backend que indica si el perfil del usuario está completo. Puede o no estar presente en la respuesta del backend.
- **Complete_Profile**: Un perfil cuyos campos requeridos (required) están todos presentes. No requiere que el perfil esté lleno al 100%.
- **Incomplete_Profile**: Un perfil al que le falta al menos uno de sus campos requeridos.
- **Required_Fields**: El conjunto de campos del UserProfileDto marcados como requeridos (no opcionales) para considerar un perfil completo.
- **Completeness_Resolver**: La lógica del Frontend que determina si un perfil es Complete_Profile o Incomplete_Profile, priorizando la Profile_Completeness_Flag del backend y recurriendo al cálculo por Required_Fields como respaldo.
- **Profile_Completion_Flow**: El flujo de la aplicación en el que el usuario completa su perfil tras el registro.
- **Feed**: La vista principal de la aplicación servida en la ruta `/feed`.
- **Post_Login_Destination**: El destino al que se dirige al usuario tras un inicio de sesión exitoso, determinado por la completitud del perfil (el Feed o el Profile_Completion_Flow).
- **Error_Body**: El cuerpo de respuesta de error del backend, con la forma `{ "error": "<mensaje>" }`.

## Requirements

### Requisito 1: Formulario de registro reducido a correo y contraseña

**Historia de usuario:** Como nueva persona usuaria, quiero registrarme aportando solo mi correo y contraseña, para crear mi cuenta rápidamente sin llenar datos de perfil.

#### Criterios de Aceptación

1. THE RegisterPage SHALL presentar campos de entrada únicamente para el correo, la contraseña y la confirmación de contraseña.
2. THE RegisterPage SHALL excluir del formulario los campos de nombre (`full_name`) y de club.
3. IF el correo enviado está vacío o contiene únicamente espacios en blanco, THEN THE RegisterPage SHALL impedir el envío, mostrar el mensaje "El correo electrónico es obligatorio" y conservar los valores ya ingresados en el formulario, exceptuando el campo de contraseña.
4. IF el correo enviado supera los 254 caracteres, THEN THE RegisterPage SHALL impedir el envío, mostrar el mensaje "El correo electrónico no debe superar los 254 caracteres" y conservar los valores ya ingresados en el formulario, exceptuando el campo de contraseña.
5. IF el correo enviado no tiene el formato `local@dominio`, con al menos un carácter antes del símbolo `@` y un dominio con extensión después del símbolo `@`, THEN THE RegisterPage SHALL impedir el envío, mostrar el mensaje "El formato del correo electrónico no es válido" y conservar los valores ya ingresados en el formulario, exceptuando el campo de contraseña.
6. IF la contraseña enviada tiene menos de 8 caracteres o más de 72 caracteres, THEN THE RegisterPage SHALL impedir el envío y mostrar el mensaje "La contraseña debe tener entre 8 y 72 caracteres".
7. IF la contraseña enviada no coincide con el valor de confirmación, THEN THE RegisterPage SHALL impedir el envío y mostrar el mensaje "Las contraseñas no coinciden".
8. WHEN el formulario es válido y la persona usuaria confirma el envío, THE RegisterPage SHALL habilitar el control de envío en un plazo máximo de 1 segundo.
9. WHILE el formulario es inválido, THE RegisterPage SHALL mantener el control de envío deshabilitado.

### Requisito 2: Contrato de la petición de registro reducida

**Historia de usuario:** Como nueva persona usuaria, quiero que la petición de registro envíe solo los datos mínimos, para que mi cuenta se cree sin datos de perfil innecesarios.

#### Criterios de Aceptación

1. WHEN la RegisterPage envía un registro con los campos `email` y `password` no vacíos, THE AuthService SHALL enviar una petición `POST` al Register_Endpoint con un cuerpo que contiene exactamente los campos `email` y `password`, salvo la inclusión condicional del `tenant_id` según el Criterio 4.
2. THE AuthService SHALL excluir el campo `full_name` del cuerpo de la petición al Register_Endpoint.
3. THE AuthService SHALL excluir del cuerpo de la petición al Register_Endpoint cualquier campo de perfil distinto del conjunto permitido (`email`, `password` y, cuando aplique, `tenant_id`).
4. THE Frontend SHALL definir el modelo de la petición de registro con exactamente los campos `email` y `password`, incorporando el campo `tenant_id` únicamente cuando el diseño determine que el Register_Endpoint lo requiere.
5. IF la RegisterPage intenta enviar un registro con el campo `email` o el campo `password` vacíos, THEN THE AuthService SHALL no enviar la petición al Register_Endpoint y THE RegisterPage SHALL indicar el error de validación correspondiente.
6. WHERE el diseño determine que el Register_Endpoint requiere un `tenant_id`, THE AuthService SHALL incluir el `tenant_id` en el cuerpo de la petición obteniéndolo de una fuente no interactiva y sin recolectarlo mediante ningún campo visible del formulario de registro.

   > Nota (decisión pendiente para diseño): El spec `auth-backend-integration` definía `tenant_id` como campo requerido del registro recolectado en el formulario. Esta reforma elimina ese campo del formulario. El diseño debe determinar si el Register_Endpoint sigue necesitando `tenant_id` y, en caso afirmativo, de qué fuente no interactiva se obtiene (por ejemplo, configuración, un tenant por defecto, o derivado del contexto). Si el backend ya no lo requiere, este criterio no aplica y `tenant_id` se elimina del modelo de la petición.

### Requisito 3: Respuesta y manejo de errores del registro

**Historia de usuario:** Como nueva persona usuaria, quiero recibir feedback claro tras registrarme, para saber si mi cuenta fue creada o por qué no lo fue.

#### Criterios de Aceptación

1. WHEN el Register_Endpoint devuelve una respuesta 201, THE RegisterPage SHALL mostrar, en un plazo máximo de 2 segundos, un mensaje de confirmación indicando que la cuenta fue creada correctamente.
2. IF el Register_Endpoint devuelve una respuesta 409, THEN THE RegisterPage SHALL mostrar un mensaje indicando que el correo electrónico ya está registrado y SHALL conservar los datos previamente ingresados en el formulario, exceptuando el campo de contraseña.
3. IF el Register_Endpoint devuelve una respuesta 400, THEN THE RegisterPage SHALL mostrar un mensaje de error de validación derivado del Error_Body y SHALL conservar los datos previamente ingresados en el formulario, exceptuando el campo de contraseña.
4. IF el Register_Endpoint devuelve una respuesta 400 con un Error_Body vacío o sin un campo de detalle de validación legible, THEN THE RegisterPage SHALL mostrar un mensaje de error de validación genérico indicando que los datos ingresados no son válidos.
5. IF el Register_Endpoint devuelve una respuesta 500, THEN THE RegisterPage SHALL mostrar un mensaje de error genérico indicando que ocurrió un problema en el servidor y SHALL conservar los datos previamente ingresados en el formulario, exceptuando el campo de contraseña.
6. IF la petición de registro no puede alcanzar el backend dentro de un tiempo de espera máximo de 10 segundos, THEN THE AuthService SHALL devolver un error con código de estado 0 y un mensaje de conectividad, y THE RegisterPage SHALL mostrar un mensaje indicando que no se pudo conectar con el servidor.

### Requisito 4: Obtención del perfil tras el inicio de sesión

**Historia de usuario:** Como persona usuaria que inicia sesión, quiero que la aplicación conozca el estado de mi perfil, para ser dirigida al lugar correcto.

#### Criterios de Aceptación

1. WHEN el Login_Endpoint devuelve una respuesta de autenticación completada, THE Frontend SHALL obtener el perfil del usuario autenticado desde el Profile_Endpoint antes de determinar el Post_Login_Destination.
2. WHEN el Profile_Endpoint devuelve una respuesta exitosa dentro de un tiempo de espera máximo de 10 segundos, THE Frontend SHALL representar el perfil obtenido usando el modelo UserProfileDto.
3. IF la obtención del perfil desde el Profile_Endpoint falla por un error de conectividad o supera el tiempo de espera máximo de 10 segundos, THEN THE Frontend SHALL mostrar un mensaje de error de conectividad, permanecer en la pantalla de inicio de sesión actual y no navegar al Feed ni al Profile_Completion_Flow.
4. IF el Profile_Endpoint devuelve una respuesta de error distinta de un error de conectividad, THEN THE Frontend SHALL mostrar un mensaje de error, permanecer en la pantalla de inicio de sesión actual y no navegar al Feed ni al Profile_Completion_Flow.
5. WHEN la completitud del perfil ha sido resuelta mediante el Completeness_Resolver, THE Frontend SHALL determinar el Post_Login_Destination a partir del resultado de esa resolución.

### Requisito 5: Resolución de la completitud del perfil

**Historia de usuario:** Como persona usuaria, quiero que la aplicación decida correctamente si mi perfil está completo, para no repetir pasos ni quedar bloqueada.

#### Criterios de Aceptación

1. WHERE la respuesta del backend incluye una Profile_Completeness_Flag con un valor booleano `true` o `false`, THE Completeness_Resolver SHALL determinar la completitud del perfil a partir del valor de la Profile_Completeness_Flag, con precedencia sobre el cálculo de respaldo por Required_Fields.
2. IF la respuesta del backend no incluye una Profile_Completeness_Flag, o la incluye con un valor nulo o no booleano, THEN THE Completeness_Resolver SHALL determinar la completitud del perfil evaluando la presencia de todos los Required_Fields del UserProfileDto.
3. WHEN todos los Required_Fields del UserProfileDto están presentes, entendiéndose presente como un valor no nulo y distinto de cadena vacía, THE Completeness_Resolver SHALL clasificar el perfil como Complete_Profile.
4. IF al menos uno de los Required_Fields del UserProfileDto está ausente, entendiéndose ausente como un valor nulo o una cadena vacía, THEN THE Completeness_Resolver SHALL clasificar el perfil como Incomplete_Profile.
5. THE Completeness_Resolver SHALL clasificar un perfil como Complete_Profile sin exigir que los campos opcionales del UserProfileDto estén presentes.
6. THE Completeness_Resolver SHALL completar cada evaluación de completitud del perfil en un plazo máximo de 200 milisegundos.
7. IF la evaluación de completitud del perfil falla, THEN THE Completeness_Resolver SHALL clasificar el perfil como Incomplete_Profile, presentar una indicación de error y conservar el estado del UserProfileDto.

   > Nota (decisión pendiente para diseño): La fuente de verdad definitiva de la completitud queda abierta. Los criterios anteriores fijan el comportamiento requerido: preferir la señal del backend (Profile_Completeness_Flag) cuando exista, y usar el cálculo del Frontend por Required_Fields como respaldo. El diseño debe (a) confirmar si el backend expondrá la Profile_Completeness_Flag y su ubicación en la respuesta, y (b) definir el conjunto exacto de Required_Fields del UserProfileDto usados por el respaldo del Frontend.

### Requisito 6: Enrutamiento posterior al inicio de sesión según la completitud

**Historia de usuario:** Como persona usuaria que inicia sesión, quiero ser dirigida al feed cuando mi perfil está completo o al flujo de completar perfil cuando no lo está, para continuar sin fricción.

#### Criterios de Aceptación

1. WHEN el Completeness_Resolver clasifica el perfil como Complete_Profile y no existe una URL de retorno almacenada, THE Frontend SHALL navegar al Feed como Post_Login_Destination en un plazo máximo de 2 segundos tras la clasificación.
2. WHEN el Completeness_Resolver clasifica el perfil como Incomplete_Profile, THE Frontend SHALL navegar al Profile_Completion_Flow como Post_Login_Destination en un plazo máximo de 2 segundos tras la clasificación.
3. WHILE existe una URL de retorno almacenada de un intento previo de acceso y el perfil está clasificado como Complete_Profile, THE Frontend SHALL navegar a la URL de retorno como Post_Login_Destination.
4. WHILE existe una URL de retorno almacenada de un intento previo de acceso y el perfil está clasificado como Incomplete_Profile, THE Frontend SHALL priorizar el Profile_Completion_Flow sobre la URL de retorno como Post_Login_Destination.
5. IF la resolución de completitud del perfil falla o no produce una clasificación dentro de un plazo máximo de 5 segundos, THEN THE Frontend SHALL navegar al Profile_Completion_Flow como Post_Login_Destination y presentar un mensaje al usuario indicando que no se pudo determinar el destino.

   > Nota (decisión pendiente para diseño): El comportamiento actual del LoginPage (definido en `auth-backend-integration`) navega a una URL de retorno cuando existe, o al `/feed` en caso contrario. El diseño debe reconciliar la URL de retorno con el enrutamiento por completitud: un perfil incompleto debería dirigir primero al Profile_Completion_Flow.

### Requisito 7: Consistencia con el flujo de reto de inicio de sesión

**Historia de usuario:** Como persona usuaria cuyo inicio de sesión requiere un reto, quiero que el enrutamiento por completitud de perfil se aplique también tras completar el reto, para llegar al destino correcto.

#### Criterios de Aceptación

1. WHEN el inicio de sesión se completa mediante el flujo de reto `NEW_PASSWORD_REQUIRED` definido en `auth-backend-integration`, THE Frontend SHALL aplicar la misma resolución de completitud del perfil y el mismo enrutamiento posterior definidos en los Requisitos 4, 5 y 6, sin diferencias de comportamiento respecto al inicio de sesión sin reto.
2. WHEN se completa el flujo de reto `NEW_PASSWORD_REQUIRED` y la resolución de completitud del perfil finaliza, THE Frontend SHALL ejecutar el enrutamiento posterior en un plazo máximo de 2 segundos tras la finalización de la resolución.
3. IF la resolución de completitud del perfil falla tras completar el flujo de reto `NEW_PASSWORD_REQUIRED`, THEN THE Frontend SHALL mantener la sesión autenticada activa, aplicar el comportamiento de manejo de error definido en los Requisitos 4, 5 y 6, y presentar un indicador de error que informe que no se pudo determinar el destino.
4. WHILE la resolución de completitud del perfil está en curso tras completar el flujo de reto `NEW_PASSWORD_REQUIRED`, THE Frontend SHALL impedir el acceso a rutas protegidas hasta que el enrutamiento posterior se haya resuelto.

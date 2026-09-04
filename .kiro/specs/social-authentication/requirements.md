# Requirements Document

## Introduction

Este documento especifica los requisitos para la funcionalidad de **Autenticación Social** de la aplicación Sora Sport. La funcionalidad permite a las personas usuarias iniciar sesión y registrarse mediante proveedores de identidad federados: **Google (Gmail)**, **Facebook** y **Sign in with Apple**. La funcionalidad debe operar de forma consistente en las tres plataformas objetivo: la aplicación **Web** (Angular 22 con componentes standalone), **Android** e **iOS**.

La autenticación social se integra con el backend existente (basado en AWS Cognito con proveedores de identidad federados vía OAuth / Hosted UI). Tras la autenticación del proveedor, el backend emite el **mismo par de tokens** (`TokenPair`) que utiliza la autenticación tradicional por correo y contraseña, de modo que los mecanismos existentes del frontend (`Auth_Service` basado en signals, `Auth_Interceptor`, `Auth_Guard` y `Token_Storage_Service`) sigan funcionando sin cambios en su contrato.

Esta funcionalidad complementa (no reemplaza) la autenticación existente por correo y contraseña descrita en la spec `authentication`.

**Fuera de alcance:** La selección de tenant/institución (elegir un club, o permanecer como persona individual, etc.) **NO** forma parte del flujo de autenticación social. La selección de tenant es un paso **posterior a la autenticación** y se aborda en una funcionalidad independiente. El flujo de login social se completa únicamente con la emisión de tokens y el establecimiento de la sesión.

## Glossary

- **Social_Auth**: El conjunto de flujos de la aplicación que permiten autenticarse mediante proveedores de identidad federados.
- **Provider (Proveedor)**: Un proveedor de identidad federado soportado: Google, Facebook o Apple.
- **Google_Provider**: El proveedor de identidad federado de Google (Gmail).
- **Facebook_Provider**: El proveedor de identidad federado de Facebook.
- **Apple_Provider**: El proveedor de identidad federado Sign in with Apple.
- **Auth_Service**: El servicio inyectable de Angular que gestiona el estado de autenticación (mediante signals `isAuthenticated`, `userRoles`, `isLoading`), el almacenamiento de tokens y las llamadas HTTP a los endpoints de autenticación del backend.
- **Auth_Interceptor**: El interceptor HTTP de Angular que adjunta el access_token como Bearer y gestiona las respuestas 401 mediante refresco de token.
- **Auth_Guard**: El guardián funcional de rutas (`CanActivateFn`) que protege las rutas de la aplicación y preserva la URL de retorno.
- **Token_Storage_Service**: El servicio que almacena tokens (clave `sora-sport-auth-tokens`), roles (clave `sora-sport-auth-roles`) y la URL de retorno (clave `sora-sport-return-url`) en el almacenamiento del cliente.
- **Token_Pair**: El conjunto de tokens que emite el backend tras una autenticación exitosa: `access_token`, `id_token`, `refresh_token` y `expires_in`.
- **Login_Component**: El componente standalone de Angular que renderiza la pantalla de inicio de sesión.
- **Register_Component**: El componente standalone de Angular que renderiza la pantalla de registro.
- **Social_Callback_Handler**: El componente o ruta de la aplicación que recibe y procesa el redireccionamiento (callback) de vuelta desde el proveedor tras completar el flujo OAuth en la Web.
- **Return_URL**: La URL originalmente solicitada por una persona usuaria no autenticada, preservada por el `Auth_Guard` para redirigir tras autenticarse.
- **Private_Relay**: La función de Apple "Ocultar mi correo" (Hide My Email) que entrega al backend una dirección de correo de retransmisión anónima en lugar del correo real de la persona usuaria.
- **Account_Linking (Vinculación de cuentas)**: El proceso mediante el cual una identidad social se asocia a una cuenta de usuario existente que comparte la misma dirección de correo.
- **Guideline_4_8**: La directriz 4.8 de la App Store de Apple, que exige ofrecer Sign in with Apple en iOS cuando la aplicación ofrece otros servicios de inicio de sesión social de terceros.

## Requirements

### Requisito 1: Inicio de sesión con proveedores sociales

**Historia de usuario:** Como persona usuaria registrada, quiero iniciar sesión con Google, Facebook o Apple desde la pantalla de inicio de sesión, para acceder a la aplicación sin recordar una contraseña.

#### Criterios de aceptación

1. THE Login_Component SHALL mostrar un botón de inicio de sesión diferenciado para cada uno de los proveedores Google, Facebook y Apple.
2. WHEN la persona usuaria selecciona un botón de proveedor, THE Social_Auth SHALL iniciar el flujo de autenticación OAuth del Provider seleccionado.
3. WHEN el Provider autentica correctamente a la persona usuaria, THE Auth_Service SHALL recibir del backend un Token_Pair con los campos access_token, id_token, refresh_token y expires_in.
4. WHEN el backend devuelve un Token_Pair y los roles tras la autenticación social, THE Auth_Service SHALL almacenar el Token_Pair mediante el Token_Storage_Service y almacenar los roles devueltos.
5. WHEN la autenticación social finaliza correctamente, THE Auth_Service SHALL establecer el signal isAuthenticated en verdadero y el signal userRoles con los roles devueltos por el backend.
6. WHEN la autenticación social finaliza correctamente y no existe una Return_URL almacenada, THE Social_Auth SHALL navegar a la ruta principal de la aplicación.
7. WHEN la autenticación social finaliza correctamente y existe una Return_URL almacenada válida, THE Social_Auth SHALL navegar a la Return_URL almacenada.
8. WHILE un flujo de autenticación social está en progreso, THE Auth_Service SHALL establecer el signal isLoading en verdadero.
9. WHEN un flujo de autenticación social finaliza con éxito o con error, THE Auth_Service SHALL establecer el signal isLoading en falso.
10. WHILE un flujo de autenticación social está en progreso, THE Login_Component SHALL deshabilitar los botones de proveedor y mostrar un indicador de carga.
11. IF el Provider rechaza la autenticación o la persona usuaria la cancela, THEN THE Auth_Service SHALL no almacenar ningún token, mantener el signal isAuthenticated en falso y notificar la condición de error a la interfaz.
12. IF el backend no devuelve un Token_Pair válido con los cuatro campos requeridos (access_token, id_token, refresh_token, expires_in), THEN THE Auth_Service SHALL descartar cualquier dato parcial recibido y mantener el signal isAuthenticated en falso.
13. WHEN un flujo de autenticación social finaliza con error, THE Login_Component SHALL rehabilitar los botones de proveedor, ocultar el indicador de carga y mostrar un mensaje de error.

### Requisito 2: Registro (alta) mediante proveedores sociales

**Historia de usuario:** Como persona nueva, quiero registrarme con Google, Facebook o Apple, para crear una cuenta sin completar un formulario de contraseña.

#### Criterios de aceptación

1. THE Register_Component SHALL mostrar, para cada proveedor (Google, Facebook y Apple), un botón identificable por el nombre y el logotipo del proveedor.
2. WHEN una persona usuaria se autentica por primera vez con un Provider y no existe una cuenta asociada a su correo, THE Social_Auth SHALL crear una cuenta nueva utilizando únicamente el correo y el nombre compartidos por el Provider.
3. WHEN el backend crea una cuenta nueva a partir de una autenticación social, THE Auth_Service SHALL recibir un Token_Pair y establecer la sesión de la misma forma que en un inicio de sesión social exitoso.
4. THE Social_Auth SHALL utilizar el mismo flujo de proveedor tanto para el registro por primera vez como para el inicio de sesión posterior, de modo que la persona usuaria no deba distinguir entre ambos casos.
5. WHERE el Provider comparte el nombre de la persona usuaria, THE Social_Auth SHALL incluir el nombre en la solicitud de creación de cuenta enviada al backend.
6. IF el flujo del Provider falla o la persona usuaria lo cancela durante el registro, THEN THE Social_Auth SHALL no crear ninguna cuenta y devolver a la persona usuaria a la pantalla de registro sin sesión establecida.
7. IF el Provider no comparte una dirección de correo durante el registro, THEN THE Social_Auth SHALL no crear la cuenta y mostrar un mensaje que indique que se requiere compartir el correo.

### Requisito 3: Emisión y manejo de tokens compatibles

**Historia de usuario:** Como responsable del producto, quiero que la autenticación social reutilice el mismo contrato de tokens que la autenticación por contraseña, para que el interceptor, el guard y el estado de sesión existentes sigan funcionando sin modificaciones en su contrato.

#### Criterios de aceptación

1. WHEN la autenticación social finaliza correctamente, THE backend SHALL emitir un Token_Pair con la misma forma (access_token, id_token, refresh_token, expires_in) que emite la autenticación por correo y contraseña.
2. THE Auth_Service SHALL almacenar el Token_Pair de origen social mediante el Token_Storage_Service en la clave sora-sport-auth-tokens, de forma idéntica al almacenamiento de tokens de la autenticación por contraseña.
3. WHEN una petición HTTP posterior a un inicio de sesión social recibe una respuesta 401 y existe un refresh_token almacenado, THE Auth_Interceptor SHALL solicitar el refresco del token contra el endpoint /auth/refresh sin requerir reautenticación con el Provider.
4. IF el refresco de token contra /auth/refresh falla, THEN THE Auth_Service SHALL limpiar los tokens almacenados, establecer isAuthenticated en falso y redirigir a la pantalla de inicio de sesión.
5. IF una respuesta 401 ocurre y no existe un refresh_token almacenado, THEN THE Auth_Interceptor SHALL no intentar el refresco y THE Auth_Service SHALL redirigir a la pantalla de inicio de sesión.
6. THE Auth_Interceptor SHALL adjuntar el access_token de origen social como token Bearer en la cabecera Authorization de las peticiones salientes, de forma idéntica a los tokens de la autenticación por contraseña.
7. THE Social_Auth SHALL establecer los signals isAuthenticated y userRoles del Auth_Service utilizando los mismos mecanismos que la autenticación por contraseña.

### Requisito 4: Vinculación de cuentas por correo coincidente

**Historia de usuario:** Como persona usuaria que ya tiene una cuenta de correo y contraseña, quiero que al iniciar sesión con un proveedor social que usa el mismo correo se vincule a mi cuenta existente, para no crear una cuenta duplicada.

#### Criterios de aceptación

1. WHEN una persona usuaria se autentica con un Provider usando una dirección de correo que, comparada sin distinción de mayúsculas y minúsculas, coincide con el correo de una cuenta existente de correo y contraseña, THE Social_Auth SHALL vincular la identidad social a la cuenta existente sin crear una cuenta nueva.
2. WHEN una identidad social se vincula a una cuenta existente, THE Auth_Service SHALL emitir un Token_Pair asociado a esa cuenta y establecer la sesión con el mismo estado de autenticación y los mismos privilegios que en un inicio de sesión social exitoso.
3. WHERE el backend requiere una verificación adicional antes de vincular una identidad social a una cuenta existente, THE Social_Auth SHALL mostrar un mensaje que indique a la persona usuaria los pasos de verificación requeridos y no completar la vinculación hasta que la verificación finalice con éxito.
4. IF la verificación adicional requerida no se completa con éxito dentro de los 300 segundos posteriores a su solicitud, THEN THE Social_Auth SHALL cancelar el intento de vinculación, no crear una cuenta nueva, conservar sin cambios la cuenta existente y mostrar un mensaje que indique que la verificación expiró y cómo reintentarla.
5. IF la vinculación de una identidad social falla porque el correo pertenece a una cuenta con un método de autenticación en conflicto, THEN THE Social_Auth SHALL rechazar la vinculación, conservar sin cambios la cuenta existente sin crear una cuenta nueva ni una identidad social parcial, y mostrar un mensaje de error que indique cómo iniciar sesión con el método original.

### Requisito 5: Manejo de cancelación y errores del proveedor

**Historia de usuario:** Como persona usuaria, quiero recibir mensajes claros cuando la autenticación social no se complete, para entender qué ocurrió y poder reintentar.

#### Criterios de aceptación

1. IF la persona usuaria cancela el flujo de autenticación del Provider, THEN THE Social_Auth SHALL devolver a la persona usuaria a la pantalla de inicio de sesión sin mostrar ningún mensaje de error de fallo y sin modificar el estado de sesión previo.
2. IF el Provider devuelve un error durante el flujo de autenticación, THEN THE Social_Auth SHALL mostrar un mensaje de error visible que indique que la autenticación con el proveedor no se pudo completar y SHALL mantener a la persona usuaria en la pantalla de inicio de sesión.
3. IF ocurre un fallo de red durante el flujo de autenticación social, THEN THE Social_Auth SHALL mostrar un mensaje de error visible que indique un problema de conexión e informe que la persona usuaria puede volver a iniciar el flujo desde el botón de proveedor.
4. IF no se recibe respuesta del Provider dentro de los 30 segundos posteriores al inicio del flujo de autenticación social, THEN THE Social_Auth SHALL cancelar el intento y SHALL mostrar un mensaje de error visible que indique un problema de conexión e informe que se puede reintentar.
5. IF el backend devuelve un error tras recibir la respuesta del Provider, THEN THE Social_Auth SHALL mostrar un mensaje de error visible que refleje el motivo de fallo devuelto por el backend y SHALL mantener a la persona usuaria en la pantalla de inicio de sesión.
6. WHEN un intento de autenticación social termina en cancelación, error del proveedor, fallo de red, timeout o error del backend, THE Auth_Service SHALL establecer el signal isLoading en falso.
7. WHEN un intento de autenticación social termina en cancelación, error del proveedor, fallo de red, timeout o error del backend, THE Login_Component SHALL rehabilitar todos los botones de proveedor.

### Requisito 6: Manejo del correo no compartido (Private Relay de Apple)

**Historia de usuario:** Como persona usuaria que usa "Ocultar mi correo" de Apple o que no comparte su correo, quiero poder completar la autenticación de todas formas, para acceder a la aplicación respetando mi privacidad.

#### Criterios de aceptación

1. WHEN el Apple_Provider entrega una dirección Private_Relay en lugar del correo real, THE Social_Auth SHALL crear o establecer la sesión de la cuenta utilizando la dirección Private_Relay como identificador de correo persistente y estable entre autenticaciones sucesivas de la misma persona usuaria.
2. IF un Provider no comparte ninguna dirección de correo con el backend, THEN THE Social_Auth SHALL cancelar la creación de la cuenta, conservar sin cambios cualquier sesión o dato de cuenta previo, y mostrar un mensaje que indique que se requiere compartir el correo para completar la creación de la cuenta.
3. WHEN el Apple_Provider comparte el nombre de la persona usuaria únicamente en la primera autenticación, THE Social_Auth SHALL enviar dicho nombre al backend durante esa primera autenticación para su persistencia.
4. IF el backend no confirma la persistencia del nombre enviado durante la primera autenticación dentro de 10 segundos, THEN THE Social_Auth SHALL completar la autenticación y establecer la sesión sin el nombre, e indicar mediante un mensaje que el nombre no pudo guardarse.
5. WHILE una autenticación posterior a la primera no incluya el nombre de la persona usuaria, THE Social_Auth SHALL conservar el nombre previamente persistido sin sobrescribirlo con un valor vacío.

### Requisito 7: Cobertura de plataformas (Web, Android e iOS)

**Historia de usuario:** Como responsable del producto, quiero que los tres proveedores funcionen en Web, Android e iOS, para ofrecer una experiencia de inicio de sesión consistente en todas las plataformas.

#### Criterios de aceptación

1. WHEN la persona usuaria selecciona un proveedor en la plataforma Web, THE Social_Auth SHALL ofrecer inicio de sesión y registro con Google_Provider, Facebook_Provider y Apple_Provider.
2. WHEN la persona usuaria selecciona un proveedor en la plataforma Android, THE Social_Auth SHALL ofrecer inicio de sesión y registro con Google_Provider, Facebook_Provider y Apple_Provider.
3. WHEN la persona usuaria selecciona un proveedor en la plataforma iOS, THE Social_Auth SHALL ofrecer inicio de sesión y registro con Google_Provider, Facebook_Provider y Apple_Provider.
4. WHERE la plataforma es iOS y se ofrecen los proveedores Google_Provider o Facebook_Provider, THE Social_Auth SHALL presentar el Apple_Provider en la misma interfaz de selección de proveedores, en cumplimiento de la Guideline_4_8.
5. WHEN la autenticación social finaliza correctamente en cualquiera de las tres plataformas, THE Social_Auth SHALL emitir un Token_Pair con la misma estructura de campos y establecer un estado de sesión observable equivalente (persona usuaria autenticada y sesión activa).
6. IF la autenticación social falla en cualquiera de las tres plataformas, THEN THE Social_Auth SHALL rechazar el intento sin establecer sesión, conservar el estado previo de no autenticación y mostrar un mensaje de error.

### Requisito 8: Preservación de la URL de retorno a través del redireccionamiento

**Historia de usuario:** Como persona usuaria que intentó acceder a una página protegida, quiero volver a esa página tras autenticarme con un proveedor social, para no perder el contexto de mi navegación.

#### Criterios de aceptación

1. WHEN una persona usuaria no autenticada intenta acceder a una ruta protegida, THE Auth_Guard SHALL preservar la Return_URL correspondiente a esa ruta mediante el Token_Storage_Service, con una longitud máxima de 2048 caracteres, antes de redirigir a la pantalla de inicio de sesión.
2. IF el Token_Storage_Service no logra almacenar la Return_URL, THEN THE Auth_Guard SHALL continuar el redirigido a la pantalla de inicio de sesión sin Return_URL almacenada y registrar la condición de fallo de almacenamiento.
3. WHEN la autenticación social finaliza correctamente y existe una Return_URL almacenada válida que apunta a una ruta interna de la aplicación, THE Social_Auth SHALL navegar a la Return_URL almacenada.
4. IF la autenticación social finaliza correctamente y no existe una Return_URL almacenada, o la Return_URL almacenada es inválida o apunta a un dominio externo a la aplicación, THEN THE Social_Auth SHALL navegar a la ruta principal por defecto.
5. WHEN la navegación posterior a la autenticación social se completa, THE Auth_Service SHALL eliminar la Return_URL almacenada del Token_Storage_Service.
6. WHEN se inicia el redireccionamiento de ida y vuelta del Provider, THE Social_Auth SHALL preservar la Return_URL de modo que el Social_Callback_Handler pueda recuperarla sin alteración tras el callback.

### Requisito 9: Consentimiento y datos de perfil solicitados

**Historia de usuario:** Como persona usuaria preocupada por mi privacidad, quiero saber qué datos se solicitan a mi proveedor social, para dar un consentimiento informado.

#### Criterios de aceptación

1. THE Social_Auth SHALL solicitar a cada Provider únicamente los datos de perfil de correo electrónico y nombre, sin incluir ningún otro campo de perfil.
2. THE Social_Auth SHALL limitar los permisos solicitados a cada Provider exclusivamente a los alcances de lectura de correo electrónico y nombre necesarios para la creación de la cuenta y el establecimiento de la sesión.
3. WHERE la interfaz muestra los botones de proveedor, THE Social_Auth SHALL mostrar un enlace o control visible que dé acceso a la información sobre los datos solicitados (correo electrónico y nombre) y sobre su tratamiento, antes de que la persona usuaria inicie la autenticación.
4. WHEN la persona usuaria activa el control de información sobre datos y tratamiento, THE Social_Auth SHALL presentar la lista de datos solicitados (correo electrónico y nombre) y la finalidad de su tratamiento.
5. IF un Provider requiere permisos adicionales a los alcances de correo electrónico y nombre para completar la autenticación, THEN THE Social_Auth SHALL cancelar el flujo de autenticación y presentar un mensaje que indique que no se puede continuar sin otorgar permisos no previstos, preservando el estado previo de no autenticación de la persona usuaria.

### Requisito 10: Delimitación respecto a la selección de tenant

**Historia de usuario:** Como responsable del producto, quiero que el flujo de autenticación social termine al establecer la sesión, para que la elección de tenant/institución ocurra como un paso separado posterior al inicio de sesión.

#### Criterios de aceptación

1. THE Social_Auth SHALL completar el flujo de autenticación social sin solicitar ni recibir un identificador de tenant/institución como entrada.
2. WHEN la autenticación social finaliza correctamente, THE Social_Auth SHALL establecer la sesión y finalizar el flujo sin ejecutar ningún paso de selección de tenant.
3. WHEN la autenticación social finaliza correctamente, THE Social_Auth SHALL dejar la sesión válida y utilizable sin que se haya seleccionado ningún tenant.
4. THE Social_Auth SHALL evitar mostrar un campo de selección de institución o tenant en las pantallas de inicio de sesión y registro social.
5. IF una solicitud de autenticación social incluye un identificador de tenant/institución, THEN THE Social_Auth SHALL ignorar dicho identificador y completar el flujo sin utilizarlo.

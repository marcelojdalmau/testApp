import { FeedItem, DashboardStat, QuickAction } from '../core/models/feed.model';

// ============================================================
// Athlete Feed Data
// ============================================================

export const ATHLETE_FEED_ITEMS: FeedItem[] = [
  {
    id: 'fi_001',
    type: 'training',
    title: 'Próximo entrenamiento',
    description: 'Sesión de campo: posesión y finalización. 09:00hs en Predio Tita Mattiussi.',
    icon: 'fitness_center',
    timestamp: '2024-08-06T09:00:00',
    actionLabel: 'Ver detalle',
    actionRoute: '/management',
  },
  {
    id: 'fi_002',
    type: 'recommendation',
    title: 'Nuevo plan nutricional disponible',
    description: 'La Dra. Martina Pérez actualizó tu plan para semana de competencia.',
    icon: 'restaurant',
    timestamp: '2024-08-05T10:30:00',
    actionLabel: 'Ver plan',
    actionRoute: '/management',
  },
  {
    id: 'fi_003',
    type: 'match',
    title: 'Partido: Racing vs Independiente',
    description: 'Fecha 15 Torneo de Reserva. Sábado 10/8 a las 11:00hs.',
    icon: 'sports_soccer',
    timestamp: '2024-08-10T11:00:00',
    actionLabel: 'Ver convocatoria',
    actionRoute: '/communication',
  },
  {
    id: 'fi_004',
    type: 'news',
    title: 'Racing presentó refuerzos',
    description: 'El club confirmó la incorporación de 3 jugadores para el segundo semestre.',
    icon: 'newspaper',
    timestamp: '2024-08-04T15:00:00',
  },
  {
    id: 'fi_005',
    type: 'achievement',
    title: 'Meta alcanzada: 20 entrenamientos consecutivos',
    description: '¡Felicitaciones! Mantuviste la asistencia perfecta durante 4 semanas.',
    icon: 'emoji_events',
    timestamp: '2024-08-03T20:00:00',
  },
];

export const ATHLETE_DASHBOARD_STATS: DashboardStat[] = [
  { label: 'Entrenamientos esta semana', value: 4, icon: 'fitness_center', trend: 'up', trendValue: '+1 vs semana anterior' },
  { label: 'Próximo partido', value: 'Sáb 10/8', icon: 'sports_soccer', trend: 'neutral' },
  { label: 'Plan activo', value: 'Nutrición + PF', icon: 'assignment', trend: 'neutral' },
  { label: 'Mensajes sin leer', value: 4, icon: 'chat', trend: 'up', trendValue: '3 nuevos' },
];

export const ATHLETE_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Mi rutina', icon: 'fitness_center', route: '/management' },
  { label: 'Mi dieta', icon: 'restaurant', route: '/management' },
  { label: 'Calendario', icon: 'calendar_today', route: '/communication' },
  { label: 'Buscar profesional', icon: 'search', route: '/marketplace' },
];

// ============================================================
// Professional Feed Data
// ============================================================

export const PROFESSIONAL_FEED_ITEMS: FeedItem[] = [
  {
    id: 'fi_p01',
    type: 'recommendation',
    title: '3 consultas agendadas para hoy',
    description: 'Lucas Martínez (10:00), Franco Díaz (14:00), Nicolás Fernández (16:30).',
    icon: 'event_available',
    timestamp: '2024-08-06T07:00:00',
    actionLabel: 'Ver agenda',
    actionRoute: '/communication',
  },
  {
    id: 'fi_p02',
    type: 'convocatoria',
    title: 'Nueva solicitud de servicio',
    description: 'Franco Díaz solicita consulta nutricional para corte de peso (boxeo).',
    icon: 'person_add',
    timestamp: '2024-08-05T14:00:00',
    actionLabel: 'Ver solicitud',
    actionRoute: '/communication',
  },
  {
    id: 'fi_p03',
    type: 'news',
    title: 'Convocatoria relevante publicada',
    description: 'Racing Club busca Preparador Físico para 5ta División.',
    icon: 'work',
    timestamp: '2024-08-01T12:00:00',
    actionLabel: 'Ver convocatoria',
    actionRoute: '/marketplace',
  },
  {
    id: 'fi_p04',
    type: 'achievement',
    title: 'Nueva valoración recibida',
    description: 'Matías Rodríguez te dio 5 estrellas: "Excelente profesional".',
    icon: 'star',
    timestamp: '2024-08-04T20:00:00',
  },
];

export const PROFESSIONAL_DASHBOARD_STATS: DashboardStat[] = [
  { label: 'Deportistas a cargo', value: 5, icon: 'groups', trend: 'up', trendValue: '+2 este mes' },
  { label: 'Consultas esta semana', value: 8, icon: 'event', trend: 'neutral' },
  { label: 'Solicitudes pendientes', value: 2, icon: 'pending_actions', trend: 'up', trendValue: 'Nuevas' },
  { label: 'Valoración promedio', value: '4.8', icon: 'star', trend: 'up', trendValue: '+0.1' },
];

export const PROFESSIONAL_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Mis deportistas', icon: 'groups', route: '/management' },
  { label: 'Agenda', icon: 'calendar_today', route: '/communication' },
  { label: 'Solicitudes', icon: 'inbox', route: '/communication' },
  { label: 'Mi perfil', icon: 'person', route: '/profile' },
];

// ============================================================
// Institution Feed Data
// ============================================================

export const INSTITUTION_FEED_ITEMS: FeedItem[] = [
  {
    id: 'fi_i01',
    type: 'news',
    title: 'Plantel completo para el fin de semana',
    description: 'Todos los jugadores de Reserva confirmaron disponibilidad para el partido del sábado.',
    icon: 'groups',
    timestamp: '2024-08-05T16:00:00',
    actionLabel: 'Ver plantel',
    actionRoute: '/management',
  },
  {
    id: 'fi_i02',
    type: 'convocatoria',
    title: 'Tu convocatoria tiene 12 postulantes',
    description: '"PF para 5ta División" recibió 12 candidatos. Revisá los perfiles.',
    icon: 'people_alt',
    timestamp: '2024-08-04T10:00:00',
    actionLabel: 'Ver postulantes',
    actionRoute: '/marketplace',
  },
  {
    id: 'fi_i03',
    type: 'match',
    title: 'Próxima fecha: Racing vs Independiente',
    description: 'Reserva - Sábado 10/8 a las 11:00. Confirmar citaciones.',
    icon: 'sports_soccer',
    timestamp: '2024-08-10T11:00:00',
    actionLabel: 'Gestionar',
    actionRoute: '/management',
  },
  {
    id: 'fi_i04',
    type: 'training',
    title: 'Informe semanal de GPS disponible',
    description: 'Roberto Silva subió el informe de cargas de la semana para Reserva.',
    icon: 'analytics',
    timestamp: '2024-08-05T08:00:00',
    actionLabel: 'Ver informe',
    actionRoute: '/management',
  },
];

export const INSTITUTION_DASHBOARD_STATS: DashboardStat[] = [
  { label: 'Divisiones activas', value: 3, icon: 'account_tree', trend: 'neutral' },
  { label: 'Jugadores totales', value: 87, icon: 'groups', trend: 'up', trendValue: '+5 este mes' },
  { label: 'Staff contratado', value: 12, icon: 'badge', trend: 'neutral' },
  { label: 'Convocatorias abiertas', value: 2, icon: 'work', trend: 'neutral' },
];

export const INSTITUTION_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Planteles', icon: 'groups', route: '/management' },
  { label: 'Convocatorias', icon: 'work', route: '/marketplace' },
  { label: 'Mensajes', icon: 'chat', route: '/communication' },
  { label: 'Perfil club', icon: 'stadium', route: '/profile' },
];

// ============================================================
// Management/Brands Feed Data
// ============================================================

export const MANAGEMENT_FEED_ITEMS: FeedItem[] = [
  {
    id: 'fi_m01',
    type: 'news',
    title: 'Atleta destacado de la semana',
    description: 'Sofía Gutiérrez (Hockey - Rosario) fue citada a la Selección Argentina Sub-21.',
    icon: 'trending_up',
    timestamp: '2024-08-05T12:00:00',
    actionLabel: 'Ver perfil',
    actionRoute: '/profile',
  },
  {
    id: 'fi_m02',
    type: 'convocatoria',
    title: 'Solicitud de sponsoreo recibida',
    description: 'Matías Rodríguez (Running, Córdoba) busca sponsor de indumentaria.',
    icon: 'handshake',
    timestamp: '2024-07-30T14:00:00',
    actionLabel: 'Ver solicitud',
    actionRoute: '/marketplace',
  },
  {
    id: 'fi_m03',
    type: 'achievement',
    title: 'Tus atletas patrocinados suman 45K seguidores',
    description: 'El reach combinado de tu portfolio creció 20% este mes.',
    icon: 'analytics',
    timestamp: '2024-08-03T09:00:00',
  },
];

export const MANAGEMENT_DASHBOARD_STATS: DashboardStat[] = [
  { label: 'Atletas en portfolio', value: 8, icon: 'people', trend: 'up', trendValue: '+1' },
  { label: 'Solicitudes activas', value: 3, icon: 'inbox', trend: 'neutral' },
  { label: 'Contratos vigentes', value: 5, icon: 'description', trend: 'neutral' },
  { label: 'Reach total', value: '45K', icon: 'visibility', trend: 'up', trendValue: '+20%' },
];

export const MANAGEMENT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Buscar atletas', icon: 'search', route: '/marketplace' },
  { label: 'Solicitudes', icon: 'inbox', route: '/communication' },
  { label: 'Contratos', icon: 'description', route: '/communication' },
  { label: 'Mi perfil', icon: 'business_center', route: '/profile' },
];

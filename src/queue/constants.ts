// Kafka服务依赖注入令牌
export const KAFKA_SERVICE = Symbol('KAFKA_SERVICE');

// 队列服务依赖注入令牌
export const QUEUE_SERVICE = Symbol('QUEUE_SERVICE');

// 死信队列服务依赖注入令牌
export const DEAD_LETTER_SERVICE = Symbol('DEAD_LETTER_SERVICE');

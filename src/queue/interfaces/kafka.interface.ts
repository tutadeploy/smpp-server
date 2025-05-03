export interface ConsumerGroupStats {
  groupId: string;
  lag: number;
  status: 'up' | 'down';
  members: number;
  topics: string[];
}

export interface ConsumerStats {
  activeConsumers: number;
  totalLag: number;
  groups: ConsumerGroupStats[];
}

export interface ProducerStats {
  isConnected: boolean;
  lastMessageSentAt: Date;
  pendingMessages: number;
  messagesSentLast5Minutes: number;
  averageLatency: number;
  errors: Array<{
    code: string;
    message: string;
    timestamp: Date;
  }>;
}

export interface BrokerInfo {
  id: number;
  host: string;
  port: number;
  connected: boolean;
  lastHeartbeat: Date;
}

export interface BrokerStats {
  total: number;
  connected: number;
  brokers: BrokerInfo[];
}

export interface IKafkaService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(
    topic: string,
    messages: Array<{ key: string; value: string }>,
  ): Promise<void>;
  registerHandler(
    topic: string,
    handler: (message: any) => Promise<void>,
  ): Promise<void>;
  removeHandler(topic: string): Promise<void>;
  isConnected(): Promise<boolean>;
  getBrokerStats(): Promise<{ total: number; connected: number }>;
  getConsumerStats(): Promise<{ totalLag: number }>;
  getProducerStats(): Promise<{ errors: string[] }>;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TokenCredential, isTokenCredential, ConnectionConfig } from "@azure/core-amqp";
import {
  ServiceBusClientOptions,
  createConnectionContextForConnectionString,
  createConnectionContextForTokenCredential
} from "./constructorHelpers";
import { ConnectionContext } from "./connectionContext";
import { CreateReceiverOptions, CreateSessionReceiverOptions, ReceiveMode } from "./models";
import { ServiceBusReceiver, ServiceBusReceiverImpl } from "./receivers/receiver";
import {
  ServiceBusSessionReceiver,
  ServiceBusSessionReceiverImpl
} from "./receivers/sessionReceiver";
import { ServiceBusReceivedMessage, ServiceBusReceivedMessageWithLock } from "./serviceBusMessage";
import { ServiceBusSender, ServiceBusSenderImpl } from "./sender";
import { entityPathMisMatchError } from "./util/errors";

/**
 * A client that can create Sender instances for sending messages to queues and
 * topics as well as Receiver instances to receive messages from queues and subscriptions.
 */
export class ServiceBusClient {
  private _connectionContext: ConnectionContext;
  private _clientOptions: ServiceBusClientOptions;
  /**
   * The fully qualified namespace of the Service Bus instance for which this client is created.
   * This is likely to be similar to <yournamespace>.servicebus.windows.net.
   */
  public fullyQualifiedNamespace: string;
  /**
   * Creates an instance of the ServiceBusClient class which can be used to create senders and receivers to
   * the Azure Service Bus namespace provided in the connection string. No connection is made to the service
   * until the senders/receivers created with the client are used to send/receive messages.
   * @param connectionString A connection string for Azure Service Bus namespace.
   * NOTE: this connection string can contain an EntityPath, which is ignored.
   * @param options Options for the service bus client.
   */
  constructor(connectionString: string, options?: ServiceBusClientOptions);
  /**
   * Creates an instance of the ServiceBusClient class which can be used to create senders and receivers to
   * the Azure Service Bus namespace provided. No connection is made to the service until
   * the senders/receivers created with the client are used to send/receive messages.
   * @param fullyQualifiedNamespace The full namespace of your Service Bus instance which is
   * likely to be similar to <yournamespace>.servicebus.windows.net.
   * @param credential A credential object used by the client to get the token to authenticate the connection
   * with the Azure Service Bus. See &commat;azure/identity for creating the credentials.
   * If you're using an own implementation of the `TokenCredential` interface against AAD, then set the "scopes" for service-bus
   * to be `["https://servicebus.azure.net//user_impersonation"]` to get the appropriate token.
   * @param options - A set of options to apply when configuring the client.
   * - `retryOptions`   : Configures the retry policy for all the operations on the client.
   * For example, `{ "maxRetries": 4 }` or `{ "maxRetries": 4, "retryDelayInMs": 30000 }`.
   * - `webSocketOptions`: Configures the channelling of the AMQP connection over Web Sockets.
   */
  constructor(
    fullyQualifiedNamespace: string,
    credential: TokenCredential,
    options?: ServiceBusClientOptions
  );
  constructor(
    fullyQualifiedNamespaceOrConnectionString1: string,
    credentialOrOptions2?: TokenCredential | ServiceBusClientOptions,
    options3?: ServiceBusClientOptions
  ) {
    if (isTokenCredential(credentialOrOptions2)) {
      const fullyQualifiedNamespace: string = fullyQualifiedNamespaceOrConnectionString1;
      const credential: TokenCredential = credentialOrOptions2;
      this._clientOptions = options3 || {};

      this._connectionContext = createConnectionContextForTokenCredential(
        credential,
        fullyQualifiedNamespace,
        this._clientOptions
      );
    } else {
      const connectionString: string = fullyQualifiedNamespaceOrConnectionString1;
      this._clientOptions = credentialOrOptions2 || {};

      this._connectionContext = createConnectionContextForConnectionString(
        connectionString,
        this._clientOptions
      );
    }
    this.fullyQualifiedNamespace = this._connectionContext.config.host;
    this._clientOptions.retryOptions = this._clientOptions.retryOptions || {};

    const timeoutInMs = this._clientOptions.retryOptions.timeoutInMs;
    if (
      timeoutInMs != undefined &&
      (typeof timeoutInMs !== "number" || !isFinite(timeoutInMs) || timeoutInMs <= 0)
    ) {
      throw new Error(`${timeoutInMs} is an invalid value for retryOptions.timeoutInMs`);
    }
  }

  /**
   * Creates a receiver for an Azure Service Bus queue in peekLock mode. No connection is made
   * to the service until one of the methods on the receiver is called.
   *
   * To target sub queues like the dead letter queue or the transfer dead letter queue, provide the
   * `subQueue` in the options. To learn more about dead letter queues, see
   * https://docs.microsoft.com/azure/service-bus-messaging/service-bus-dead-letter-queues
   *
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   * In peekLock mode, the receiver has a lock on the message for the duration specified on the
   * queue.
   *
   * Messages that are not settled within the lock duration will be redelivered as many times as
   * the max delivery count set on the queue, after which they get sent to a separate dead letter
   * queue.
   *
   * You can settle a message by calling complete(), abandon(), defer() or deadletter() methods on
   * the message.
   *
   * More information about how peekLock and message settlement works here:
   * https://docs.microsoft.com/azure/service-bus-messaging/message-transfers-locks-settlement#peeklock
   *
   * @param queueName The name of the queue to receive from.
   * @param options Options to pass the receiveMode, defaulted to peekLock.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessageWithLock`
   */
  createReceiver(
    queueName: string,
    options?: CreateReceiverOptions<"peekLock">
  ): ServiceBusReceiver<ServiceBusReceivedMessageWithLock>;
  /**
   * Creates a receiver for an Azure Service Bus queue in receiveAndDelete mode. No connection is made
   * to the service until one of the methods on the receiver is called.
   *
   * To target sub queues like the dead letter queue or the transfer dead letter queue, provide the
   * `subQueue` in the options. To learn more about dead letter queues, see
   * https://docs.microsoft.com/azure/service-bus-messaging/service-bus-dead-letter-queues
   *
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   * In receiveAndDelete mode, messages are deleted from Service Bus as they are received.
   *
   * @param queueName The name of the queue to receive from.
   * @param options Options to pass the receiveMode, defaulted to receiveAndDelete.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessage`
   */
  createReceiver(
    queueName: string,
    options: CreateReceiverOptions<"receiveAndDelete">
  ): ServiceBusReceiver<ServiceBusReceivedMessage>;
  /**
   * Creates a receiver for an Azure Service Bus subscription in peekLock mode. No connection is made
   * to the service until one of the methods on the receiver is called.
   *
   * To target sub queues like the dead letter queue or the transfer dead letter queue, provide the
   * `subQueue` in the options. To learn more about dead letter queues, see
   * https://docs.microsoft.com/azure/service-bus-messaging/service-bus-dead-letter-queues
   *
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   * In peekLock mode, the receiver has a lock on the message for the duration specified on the
   * subscription.
   *
   * Messages that are not settled within the lock duration will be redelivered as many times as
   * the max delivery count set on the subscription, after which they get sent to a separate dead letter
   * queue.
   *
   * You can settle a message by calling complete(), abandon(), defer() or deadletter() methods on
   * the message.
   *
   * More information about how peekLock and message settlement works here:
   * https://docs.microsoft.com/azure/service-bus-messaging/message-transfers-locks-settlement#peeklock
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param options Options to pass the receiveMode, defaulted to peekLock.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessageWithLock`
   */
  createReceiver(
    topicName: string,
    subscriptionName: string,
    options?: CreateReceiverOptions<"peekLock">
  ): ServiceBusReceiver<ServiceBusReceivedMessageWithLock>;
  /**
   * Creates a receiver for an Azure Service Bus subscription in receiveAndDelete mode. No connection is made
   * to the service until one of the methods on the receiver is called.
   *
   *
   * To target sub queues like the dead letter queue or the transfer dead letter queue, provide the
   * `subQueue` in the options. To learn more about dead letter queues, see
   * https://docs.microsoft.com/azure/service-bus-messaging/service-bus-dead-letter-queues
   *
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   * In receiveAndDelete mode, messages are deleted from Service Bus as they are received.
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param options Options to pass the receiveMode, defaulted to receiveAndDelete.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessage`
   */
  createReceiver(
    topicName: string,
    subscriptionName: string,
    options: CreateReceiverOptions<"receiveAndDelete">
  ): ServiceBusReceiver<ServiceBusReceivedMessage>;
  createReceiver(
    queueOrTopicName1: string,
    optionsOrSubscriptionName2?:
      | CreateReceiverOptions<"receiveAndDelete">
      | CreateReceiverOptions<"peekLock">
      | string,
    options3?: CreateReceiverOptions<"receiveAndDelete"> | CreateReceiverOptions<"peekLock">
  ):
    | ServiceBusReceiver<ServiceBusReceivedMessage>
    | ServiceBusReceiver<ServiceBusReceivedMessageWithLock> {
    validateEntityPath(this._connectionContext.config, queueOrTopicName1);

    // NOTE: we don't currently have any options for this kind of receiver but
    // when we do make sure you pass them in and extract them.
    const { entityPath, receiveMode, options } = extractReceiverArguments(
      queueOrTopicName1,
      optionsOrSubscriptionName2,
      options3
    );

    let entityPathWithSubQueue = entityPath;
    if (options?.subQueue) {
      switch (options?.subQueue) {
        case "deadLetter":
          entityPathWithSubQueue += "/$DeadLetterQueue";
          break;
        case "transferDeadLetter":
          entityPathWithSubQueue += "/$Transfer/$DeadLetterQueue";
          break;
        default:
          throw new Error(
            `Invalid subQueue '${options?.subQueue}' provided. Valid values are 'deadLetter' and 'transferDeadLetter'`
          );
      }
    }

    if (receiveMode === "peekLock") {
      return new ServiceBusReceiverImpl<ServiceBusReceivedMessageWithLock>(
        this._connectionContext,
        entityPathWithSubQueue,
        receiveMode,
        this._clientOptions.retryOptions
      );
    } else {
      return new ServiceBusReceiverImpl<ServiceBusReceivedMessage>(
        this._connectionContext,
        entityPathWithSubQueue,
        receiveMode,
        this._clientOptions.retryOptions
      );
    }
  }

  /**
   * Creates a receiver for a session enabled Azure Service Bus queue in peekLock mode.
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   *
   * In peekLock mode, the receiver has a lock on the session for the duration specified on the
   * queue.
   *
   * Messages that are not settled within the lock duration will be redelivered as many times as
   * the max delivery count set on the queue, after which they get sent to a separate dead letter
   * queue.
   *
   * You can settle a message by calling complete(), abandon(), defer() or deadletter() methods on
   * the message.
   *
   * More information about how peekLock and message settlement works here:
   * https://docs.microsoft.com/azure/service-bus-messaging/message-transfers-locks-settlement#peeklock
   *
   * @param queueName The name of the queue to receive from.
   * @param options Options include receiveMode(defaulted to peekLock), options to create session receiver.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessageWithLock`
   */
  createSessionReceiver(
    queueName: string,
    options?: CreateSessionReceiverOptions<"peekLock">
  ): Promise<ServiceBusSessionReceiver<ServiceBusReceivedMessageWithLock>>;
  /**
   * Creates a receiver for a session enabled Azure Service Bus queue in receiveAndDelete mode.
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   *
   * In receiveAndDelete mode, messages are deleted from Service Bus as they are received.
   *
   * @param queueName The name of the queue to receive from.
   * @param options Options include receiveMode(defaulted to receiveAndDelete), options to create session receiver.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessage`
   */
  createSessionReceiver(
    queueName: string,
    options: CreateSessionReceiverOptions<"receiveAndDelete">
  ): Promise<ServiceBusSessionReceiver<ServiceBusReceivedMessage>>;
  /**
   * Creates a receiver for a session enabled Azure Service Bus subscription in peekLock mode.
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   *
   * In peekLock mode, the receiver has a lock on the session for the duration specified on the
   * subscription.
   *
   * Messages that are not settled within the lock duration will be redelivered as many times as
   * the max delivery count set on the subscription, after which they get sent to a separate dead letter
   * queue.
   *
   * You can settle a message by calling complete(), abandon(), defer() or deadletter() methods on
   * the message.
   *
   * More information about how peekLock and message settlement works here:
   * https://docs.microsoft.com/azure/service-bus-messaging/message-transfers-locks-settlement#peeklock
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param options Options include receiveMode(defaulted to peekLock), options to create session receiver.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessageWithLock`
   */
  createSessionReceiver(
    topicName: string,
    subscriptionName: string,
    options?: CreateSessionReceiverOptions<"peekLock">
  ): Promise<ServiceBusSessionReceiver<ServiceBusReceivedMessageWithLock>>;
  /**
   * Creates a receiver for a session enabled Azure Service Bus subscription in receiveAndDelete mode.
   * If the receiveMode is not provided in the options, it defaults to the "peekLock" mode.
   *
   * In receiveAndDelete mode, messages are deleted from Service Bus as they are received.
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param options Options include receiveMode(defaulted to receiveAndDelete), options to create session receiver.
   * @returns A receiver that can be used to receive messages of the form `ServiceBusReceivedMessage`
   */
  createSessionReceiver(
    topicName: string,
    subscriptionName: string,
    options: CreateSessionReceiverOptions<"receiveAndDelete">
  ): Promise<ServiceBusSessionReceiver<ServiceBusReceivedMessage>>;
  async createSessionReceiver(
    queueOrTopicName1: string,
    optionsOrSubscriptionName2?:
      | CreateSessionReceiverOptions<"peekLock">
      | CreateSessionReceiverOptions<"receiveAndDelete">
      | string,
    options3?:
      | CreateSessionReceiverOptions<"peekLock">
      | CreateSessionReceiverOptions<"receiveAndDelete">
  ): Promise<
    | ServiceBusSessionReceiver<ServiceBusReceivedMessage>
    | ServiceBusSessionReceiver<ServiceBusReceivedMessageWithLock>
  > {
    validateEntityPath(this._connectionContext.config, queueOrTopicName1);

    const { entityPath, receiveMode, options } = extractReceiverArguments(
      queueOrTopicName1,
      optionsOrSubscriptionName2,
      options3
    );

    return ServiceBusSessionReceiverImpl.createInitializedSessionReceiver(
      this._connectionContext,
      entityPath,
      receiveMode,
      {
        sessionId: options?.sessionId,
        maxAutoRenewLockDurationInMs: options?.maxAutoRenewLockDurationInMs,
        abortSignal: options?.abortSignal
      },
      this._clientOptions.retryOptions
    );
  }
  /**
   * Creates a Sender which can be used to send messages, schedule messages to be
   * sent at a later time and cancel such scheduled messages. No connection is made
   * to the service until one of the methods on the sender is called.
   * @param queueOrTopicName The name of a queue or topic to send messages to.
   */
  createSender(queueOrTopicName: string): ServiceBusSender {
    validateEntityPath(this._connectionContext.config, queueOrTopicName);

    return new ServiceBusSenderImpl(
      this._connectionContext,
      queueOrTopicName,
      this._clientOptions.retryOptions
    );
  }

  /**
   * Closes the underlying AMQP connection.
   * NOTE: this will also disconnect any Receiver or Sender instances created from this
   * instance.
   */
  close(): Promise<void> {
    return ConnectionContext.close(this._connectionContext);
  }
}

/**
 * Helper to validate and extract the common arguments from both the create*Receiver() overloads that
 * have this pattern:
 *
 * queue, options
 * topic, subscription, options
 *
 * @internal
 * @ignore
 */
export function extractReceiverArguments<OptionsT extends { receiveMode?: ReceiveMode }>(
  queueOrTopicName1: string,
  optionsOrSubscriptionName2: string | OptionsT | undefined,
  definitelyOptions3?: OptionsT
): {
  entityPath: string;
  receiveMode: ReceiveMode;
  options?: Omit<OptionsT, "receiveMode">;
} {
  let entityPath: string;
  let options: OptionsT | undefined;
  if (typeof optionsOrSubscriptionName2 === "string") {
    const topic = queueOrTopicName1;
    const subscription = optionsOrSubscriptionName2;
    entityPath = `${topic}/Subscriptions/${subscription}`;
    options = definitelyOptions3;
  } else {
    entityPath = queueOrTopicName1;
    options = optionsOrSubscriptionName2;
  }
  let receiveMode: ReceiveMode;
  if (options?.receiveMode == undefined || options.receiveMode === "peekLock") {
    receiveMode = "peekLock";
  } else if (options.receiveMode === "receiveAndDelete") {
    receiveMode = "receiveAndDelete";
  } else {
    throw new TypeError(
      `Invalid receiveMode '${options?.receiveMode}' provided. Valid values are 'peekLock' and 'receiveAndDelete'`
    );
  }
  delete options?.receiveMode;
  return {
    entityPath,
    receiveMode,
    options
  };
}

/**
 * Validates that the EntityPath in the connection string (if any) matches with the
 * queue or topic name passed to the methods that create senders and receivers.
 *
 * @internal
 * @ignore
 */
function validateEntityPath(connectionConfig: ConnectionConfig, queueOrTopicName: string): void {
  if (connectionConfig.entityPath && connectionConfig.entityPath !== queueOrTopicName) {
    throw new Error(entityPathMisMatchError);
  }
}

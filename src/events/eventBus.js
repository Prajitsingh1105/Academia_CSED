const EventEmitter = require('events');

const SENSITIVE_KEYS = new Set(['otp', 'resetToken', 'password']);
const redact = (data) =>
  JSON.parse(JSON.stringify(data, (k, v) => (SENSITIVE_KEYS.has(k) ? '[REDACTED]' : v)));

class EventBus extends EventEmitter {
  async publish(eventName, payload) {
    const event = {
      eventId: require('crypto').randomUUID(),
      eventType: eventName,
      timestamp: new Date().toISOString(),
      service: 'iam-auth-service',
      data: payload,
    };

    // Audit log with secrets stripped
    console.log(`[EventBus] Emitted Event: ${eventName}`, JSON.stringify({ ...event, data: redact(payload) }));

    this.emit(eventName, event);

    if (process.env.EVENT_BUS_TYPE === 'rabbitmq') {
      // await rabbitClient.publish('academia_events', eventName, Buffer.from(JSON.stringify(event)));
    }
    return event;
  }
}

const eventBus = new EventBus();

const EVENTS = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGGED_IN: 'auth.user.logged_in',
  USER_LOGGED_OUT: 'auth.user.logged_out',
  PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth.password.reset_completed',
  USER_PROFILE_UPDATED: 'auth.user.profile_updated',
  OTP_REQUESTED: 'auth.otp.requested',
};

module.exports = { eventBus, EVENTS };

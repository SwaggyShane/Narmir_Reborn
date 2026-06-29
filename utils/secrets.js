class SecretsManager {
  constructor() {
    this.requiredSecrets = {
      JWT_SECRET: {
        required: true,
        description: 'Secret key for JWT token signing',
        minLength: 32,
        env: 'JWT_SECRET'
      },
      DATABASE_URL: {
        required: true,
        description: 'PostgreSQL database connection string',
        pattern: /^postgres(ql)?:\/\/.*$/i,
        env: 'DATABASE_URL'
      },
      NODE_ENV: {
        required: false,
        description: 'Deployment environment (development/production)',
        defaultValue: 'development',
        env: 'NODE_ENV'
      },
      CORS_ORIGIN: {
        required: process.env.NODE_ENV === 'production',
        description: 'Frontend origin for CORS',
        env: 'CORS_ORIGIN'
      },
      ADMIN_SECRET: {
        required: true,
        description: 'Secret key for admin authentication',
        minLength: 16,
        env: 'ADMIN_SECRET'
      },
      CONFIRM_SECRET: {
        required: false,
        description: 'Secret key for email confirmation tokens',
        minLength: 16,
        env: 'CONFIRM_SECRET'
      },
      DISCORD_BOT_TOKEN: {
        required: false,
        description: 'Discord bot token for integrations',
        env: 'DISCORD_BOT_TOKEN'
      }
    };

    this.optionalSecrets = [
      'DISCORD_UPDATES_CHANNEL_ID',
      'DISCORD_BUG_REPORTS_CHANNEL_ID',
      'DISCORD_UPDATES_WEBHOOK_URL',
      'DISCORD_BUG_REPORTS_WEBHOOK_URL',
      'ADMIN_ALLOWED_IPS'
    ];
  }

  validateSecrets() {
    const errors = [];
    const warnings = [];
    const validated = {};

    for (const [, spec] of Object.entries(this.requiredSecrets)) {
      const value = process.env[spec.env];

      if (!value && spec.required) {
        errors.push(`❌ ${spec.env}: ${spec.description} (REQUIRED)`);
      } else if (!value && spec.defaultValue) {
        process.env[spec.env] = spec.defaultValue;
        validated[spec.env] = spec.defaultValue;
        warnings.push(`⚠️  ${spec.env}: Using default value "${spec.defaultValue}"`);
      } else if (value) {
        if (spec.minLength && value.length < spec.minLength) {
          errors.push(`❌ ${spec.env}: Too short (minimum ${spec.minLength} characters)`);
        } else if (spec.pattern && !spec.pattern.test(value)) {
          errors.push(`❌ ${spec.env}: Invalid format (expected ${spec.pattern})`);
        } else {
          validated[spec.env] = value;
        }
      }
    }

    for (const envVar of this.optionalSecrets) {
      const value = process.env[envVar];
      if (value) {
        validated[envVar] = value;
      } else {
        warnings.push(`ℹ️  ${envVar}: Not configured (optional)`);
      }
    }

    return { errors, warnings, validated };
  }

  printReport(errors, warnings) {
    if (errors.length === 0 && warnings.length === 0) {
      console.log('[secrets] ✅ All required secrets configured');
      return true;
    }

    if (errors.length > 0) {
      console.error('[secrets] Configuration errors:');
      errors.forEach(err => console.error(`  ${err}`));
      return false;
    }

    if (warnings.length > 0) {
      console.warn('[secrets] Configuration warnings:');
      warnings.forEach(warn => console.warn(`  ${warn}`));
    }

    return true;
  }

  ensureSecretsConfigured() {
    const { errors, warnings, validated } = this.validateSecrets();
    const isValid = this.printReport(errors, warnings);

    if (!isValid) {
      console.error('[secrets] ❌ Server startup blocked due to missing secrets');
      console.error('[secrets] Copy .env.example to .env and fill in all required values');
      process.exit(1);
    }

    return validated;
  }

  static validateRailwayConfig() {
    const railwayVars = [
      'RAILWAY_ENVIRONMENT_NAME',
      'RAILWAY_SERVICE_NAME',
      'RAILWAY_PRIVATE_DOMAIN'
    ];

    const isRailway = railwayVars.some(v => process.env[v]);
    if (!isRailway) return null;

    return {
      environment: process.env.RAILWAY_ENVIRONMENT_NAME || 'unknown',
      service: process.env.RAILWAY_SERVICE_NAME || 'unknown',
      domain: process.env.RAILWAY_PRIVATE_DOMAIN || 'unknown',
      isRailway: true
    };
  }

  static sanitizeForLogging(obj) {
    const sensitiveKeys = ['JWT_SECRET', 'PASSWORD', 'TOKEN', 'SECRET', 'API_KEY'];
    const sanitized = { ...obj };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive))) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

module.exports = SecretsManager;

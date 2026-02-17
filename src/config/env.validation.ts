import * as Joi from 'joi';

export function validate(config: Record<string, unknown>) {
  const schema = Joi.object({
    // Required
    JWT_SECRET: Joi.string().min(32).required(),
    DATABASE_URL: Joi.string().required(),
    DIRECT_URL: Joi.string().required(),
    PORT: Joi.number().default(3001),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

    // Required Supabase
    SUPABASE_URL: Joi.string().uri().required(),
    SUPABASE_ANON_KEY: Joi.string().required(),
    SUPABASE_JWT_SECRET: Joi.string().optional(), // No longer used for local validation
    SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

    // CORS
    CORS_ORIGINS: Joi.string().optional(),

    // Swagger
    ENABLE_SWAGGER: Joi.string().valid('true', 'false').default('true'),

    // Spotify (optional - enables import feature, but both must be present if either is set)
    SPOTIFY_CLIENT_ID: Joi.string().optional(),
    SPOTIFY_CLIENT_SECRET: Joi.string().optional(),

    // Frontend URL for QR code generation
    FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  }).and('SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET');

  const { error, value } = schema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }

  return value;
}

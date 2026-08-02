import swaggerJsdoc from 'swagger-jsdoc';

const accessDescription = [
  'Backend API for the TAMID Group at NYU website.',
  '',
  "_Where tomorrow's leaders connect with Israel's innovators._",
  '',
  'Public endpoints are available for website and end-user integrations.',
  'Endpoints tagged Admin require bearer auth with admin privileges.',
].join('\n');

const adminRequestBody = {
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', additionalProperties: true },
    },
  },
};

const uuidPathParameter = (description: string): Record<string, unknown> => ({
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description,
});

const keyPathParameter = (description: string): Record<string, unknown> => ({
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[A-Za-z0-9_.:-]+$' },
  description,
});

const adminListOperation = (tag: string, summary: string): Record<string, unknown> => ({
  tags: [tag, 'Admin'],
  summary,
  description: 'Requires bearer auth with admin privileges.',
  security: [{ bearerAuth: [] }],
  responses: {
    '200': {
      description: 'Resource rows',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              count: { type: 'integer' },
              data: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
    '401': { description: 'Missing or invalid bearer token' },
    '403': { description: 'Authenticated user is not an admin' },
    '429': { description: 'Too Many Requests' },
  },
});

const adminCreateOperation = (tag: string, summary: string): Record<string, unknown> => ({
  tags: [tag, 'Admin'],
  summary,
  description: 'Requires bearer auth with admin privileges.',
  security: [{ bearerAuth: [] }],
  requestBody: adminRequestBody,
  responses: {
    '201': {
      description: 'Resource row created',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    '401': { description: 'Missing or invalid bearer token' },
    '403': { description: 'Authenticated user is not an admin' },
    '429': { description: 'Too Many Requests' },
  },
});

const adminGetOperation = (
  tag: string,
  summary: string,
  idDescription: string
): Record<string, unknown> => ({
  tags: [tag, 'Admin'],
  summary,
  description: 'Requires bearer auth with admin privileges.',
  security: [{ bearerAuth: [] }],
  parameters: [uuidPathParameter(idDescription)],
  responses: {
    '200': {
      description: 'Resource row',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    '400': { description: 'Invalid UUID' },
    '401': { description: 'Missing or invalid bearer token' },
    '403': { description: 'Authenticated user is not an admin' },
    '404': { description: 'Resource row not found' },
    '429': { description: 'Too Many Requests' },
  },
});

const adminUpdateOperation = (
  tag: string,
  summary: string,
  idDescription: string
): Record<string, unknown> => ({
  tags: [tag, 'Admin'],
  summary,
  description: 'Requires bearer auth with admin privileges.',
  security: [{ bearerAuth: [] }],
  parameters: [uuidPathParameter(idDescription)],
  requestBody: adminRequestBody,
  responses: {
    '200': {
      description: 'Resource row updated',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    '400': { description: 'Validation error or empty update' },
    '401': { description: 'Missing or invalid bearer token' },
    '403': { description: 'Authenticated user is not an admin' },
    '404': { description: 'Resource row not found' },
    '429': { description: 'Too Many Requests' },
  },
});

const adminDeleteOperation = (
  tag: string,
  summary: string,
  idDescription: string
): Record<string, unknown> => ({
  tags: [tag, 'Admin'],
  summary,
  description: 'Requires bearer auth with admin privileges.',
  security: [{ bearerAuth: [] }],
  parameters: [uuidPathParameter(idDescription)],
  responses: {
    '200': {
      description: 'Resource row deleted',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    '400': { description: 'Invalid UUID' },
    '401': { description: 'Missing or invalid bearer token' },
    '403': { description: 'Authenticated user is not an admin' },
    '404': { description: 'Resource row not found' },
    '429': { description: 'Too Many Requests' },
  },
});

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TAMID Group at NYU API',
      version: '1.0.0',
      description: accessDescription,
    },
    servers: [
      {
        url: 'https://api.nyu-tamid.org',
        description: 'Production',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
    ],
    tags: [
      { name: 'Board Members', description: 'Public: board member directory' },
      { name: 'Events', description: 'Public: event listings and search' },
      { name: 'Contact', description: 'Public: contact form submissions, insert-only' },
      { name: 'Newsletter', description: 'Public: newsletter signups, insert-only' },
      { name: 'Members', description: 'Public: club membership directory' },
      { name: 'Semesters', description: 'Public: academic semester listing' },
      { name: 'Health', description: 'Public: server health & info' },
      { name: 'Site Config', description: 'Public: dynamic site configuration settings' },
      {
        name: 'Admin',
        description: 'Authenticated routes. Requires bearer auth with admin privileges.',
      },
      {
        name: 'Storage',
        description: 'Authenticated storage management routes.',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // ── Shared ────────────────────────────────────────────
        ApiError: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
          },
          required: ['message', 'code'],
        },
        ApiError403: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Forbidden - Invalid referer' },
                code: { type: 'string', example: 'INVALID_REFERER' },
              },
            },
          },
        },
        ApiError429: {
          oneOf: [
            {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                  example: 'Too many requests from this IP, please try again later.',
                },
                code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
              },
              required: ['error', 'code'],
            },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Rate limit exceeded',
                    },
                    code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
                  },
                },
              },
            },
          ],
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },

        // ── Board Members ─────────────────────────────────────
        BoardMember: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            position: { type: 'string', example: 'President' },
            fullName: { type: 'string', example: 'Jane Doe' },
            bio: { type: 'string' },
            major: { type: 'string', example: 'Finance' },
            year: { type: 'string', example: '2026' },
            hometown: { type: 'string', example: 'New York, NY' },
            linkedinUrl: { type: 'string', nullable: true, format: 'uri' },
            email: { type: 'string', format: 'email' },
            headshotFile: { type: 'string', nullable: true },
            headshotUpdatedAt: { type: 'string', format: 'date-time' },
            orderIndex: { type: 'integer' },
          },
        },

        // ── Events ────────────────────────────────────────────
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            title: { type: 'string', example: 'Finance Panel' },
            company: { type: 'string', example: 'Goldman Sachs' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            location: { type: 'string', example: 'KMC 2-60' },
            flyerFile: { type: 'string', nullable: true },
            rsvpLink: { type: 'string', nullable: true, format: 'uri' },
            description: { type: 'string', nullable: true },
            isVisible: { type: 'boolean', description: 'Whether the event is publicly visible' },
            semester: { type: 'string', description: 'Semester code', example: 'S26' },
          },
        },

        // ── Newsletter ────────────────────────────────────────
        NewsletterSignup: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Members ───────────────────────────────────────────
        Member: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            semester: { type: 'string', description: 'Semester code', example: 'S26' },
            email: { type: 'string', nullable: true, format: 'email' },
          },
        },

        // ── Semesters ─────────────────────────────────────────
        Semester: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            semesterName: { type: 'string', description: 'Semester code', example: 'S26' },
          },
        },

        // ── Site Config ───────────────────────────────────────
        SiteConfigItem: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'applications_open' },
            value: { type: 'string', example: 'true' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Storage ───────────────────────────────────────────
        StorageBucket: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'board-headshots' },
            name: { type: 'string', example: 'board-headshots' },
            public: { type: 'boolean', example: true },
          },
          additionalProperties: true,
        },
        StorageObject: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'headshot.jpg' },
            path: { type: 'string', example: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.jpg' },
            type: { type: 'string', enum: ['file', 'folder'] },
            metadata: { type: 'object', nullable: true, additionalProperties: true },
            publicUrl: {
              type: 'string',
              format: 'uri',
              description: 'Present for file objects.',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            lastAccessedAt: { type: 'string', format: 'date-time' },
          },
        },
        StorageUploadRequest: {
          type: 'object',
          required: ['path', 'contentBase64'],
          properties: {
            path: {
              type: 'string',
              example: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.jpg',
              description: 'Relative object path. Do not include a leading slash.',
            },
            contentBase64: {
              type: 'string',
              description: 'Base64-encoded file content. Current JSON body limit is 10 MB.',
            },
            contentType: { type: 'string', example: 'image/jpeg' },
            cacheControl: { type: 'string', example: '3600' },
            upsert: {
              type: 'boolean',
              default: false,
              description: 'When true, upload may replace an existing object.',
            },
          },
        },
        StorageUpdateRequest: {
          type: 'object',
          required: ['path'],
          properties: {
            path: { type: 'string', example: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.jpg' },
            newPath: {
              type: 'string',
              example: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.webp',
              description: 'Optional destination path for rename/move.',
            },
            contentBase64: {
              type: 'string',
              description: 'Optional replacement file content. Required when not moving.',
            },
            contentType: { type: 'string', example: 'image/jpeg' },
            cacheControl: { type: 'string', example: '3600' },
            recursive: {
              type: 'boolean',
              default: false,
              description: 'When moving virtual folders, move every object under path.',
            },
          },
        },
        StorageDeleteRequest: {
          type: 'object',
          properties: {
            path: { type: 'string', example: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.jpg' },
            paths: {
              type: 'array',
              items: { type: 'string' },
              example: [
                'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.jpg',
                'thumbnails/dbc59546-fdd5-48f5-81ff-c1ec6e5efde9.jpg',
              ],
            },
            recursive: {
              type: 'boolean',
              default: false,
              description: 'When true, delete every object under each provided path prefix.',
            },
          },
        },
        VersionedImageUpload: {
          type: 'object',
          required: ['path', 'contentBase64', 'contentType'],
          properties: {
            path: {
              type: 'string',
              example: '9e8a83da-3590-45e5-8903-3ff721521a56.webp',
              description:
                'Root-level full-size path. The filename basename must exactly equal the resource UUID from the endpoint path; directories and bucket-name prefixes are rejected.',
            },
            contentBase64: {
              type: 'string',
              description:
                'Base64-encoded image content. The full request, including both variants, must fit within the 10 MB JSON body limit.',
            },
            contentType: {
              type: 'string',
              pattern: '^image/',
              example: 'image/webp',
            },
          },
        },
        VersionedImageReplacementRequest: {
          type: 'object',
          required: ['fullSize', 'thumbnail'],
          properties: {
            fullSize: { $ref: '#/components/schemas/VersionedImageUpload' },
            thumbnail: {
              allOf: [
                { $ref: '#/components/schemas/VersionedImageUpload' },
                {
                  type: 'object',
                  properties: {
                    path: {
                      type: 'string',
                      example: 'thumbnails/9e8a83da-3590-45e5-8903-3ff721521a56.jpg',
                    },
                    contentType: { type: 'string', enum: ['image/jpeg'], example: 'image/jpeg' },
                  },
                },
              ],
              description:
                'JPEG thumbnail. The path must be exactly thumbnails/{id}.jpg, where {id} is the resource UUID from the endpoint path. contentType must be image/jpeg.',
            },
          },
        },
      },
    },
    paths: {
      // ═══════════════════════════════════════════════════════
      //  Health / Info
      // ═══════════════════════════════════════════════════════
      '/': {
        get: {
          tags: ['Health'],
          summary: 'Root – API info',
          responses: {
            '200': {
              description: 'API metadata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      version: { type: 'string' },
                      status: { type: 'string' },
                      description: { type: 'string' },
                      endpoints: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1': {
        get: {
          tags: ['Health'],
          summary: 'API Version Info',
          responses: {
            '200': {
              description: 'API version and documentation link',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      version: { type: 'string' },
                      documentation: { type: 'string' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
      },
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      timestamp: { type: 'string', format: 'date-time' },
                      uptime: { type: 'number', description: 'Uptime in seconds' },
                      environment: { type: 'string' },
                      supabase: {
                        type: 'object',
                        description:
                          'Non-secret Supabase target metadata for local admin safety checks. Never includes API keys, JWT secrets, or database credentials.',
                        properties: {
                          url: {
                            type: 'string',
                            nullable: true,
                            example: 'http://127.0.0.1:54321',
                          },
                          projectRef: {
                            type: 'string',
                            description:
                              'Supabase project ref derived from the SUPABASE_URL hostname when possible. Local loopback URLs report "local".',
                            example: 'local',
                          },
                          environment: {
                            type: 'string',
                            enum: ['local', 'production', 'unknown'],
                            example: 'local',
                          },
                          isProduction: {
                            type: 'boolean',
                            description:
                              'False only for local Supabase targets. True for the production Supabase target and unsafe unknown targets, including missing or malformed SUPABASE_URL values.',
                            example: false,
                          },
                        },
                        required: ['url', 'projectRef', 'environment', 'isProduction'],
                      },
                    },
                    required: ['status', 'timestamp', 'uptime', 'environment', 'supabase'],
                  },
                },
              },
            },
          },
        },
      },
      '/db-health': {
        get: {
          tags: ['Health'],
          summary: 'Database health check',
          description:
            'Performs a minimal read from the database to verify the connection is active. Intended for cron jobs that keep the Supabase database from pausing due to inactivity.',
          responses: {
            '200': {
              description: 'Database connection is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      message: {
                        type: 'string',
                        example: 'Database connection is healthy',
                      },
                    },
                  },
                },
              },
            },
            '503': {
              description: 'Database connection failed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'error' },
                      message: { type: 'string', example: 'DB_CONNECTION_ERROR' },
                      details: {
                        type: 'string',
                        description: 'Error details from the database driver',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ═══════════════════════════════════════════════════════
      //  Board Members
      // ═══════════════════════════════════════════════════════
      '/v1/board-members': {
        get: {
          tags: ['Board Members'],
          summary: 'Get all board members',
          responses: {
            '200': {
              description: 'List of board members',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/BoardMember' },
                      },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
        post: adminCreateOperation('Board Members', 'Admin: create board member'),
      },
      '/v1/board-members/{id}': {
        get: {
          tags: ['Board Members'],
          summary: 'Get a single board member by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Board member UUID',
            },
          ],
          responses: {
            '200': {
              description: 'Board member found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/BoardMember' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid UUID',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
            '404': {
              description: 'Board member not found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
          },
        },
        put: adminUpdateOperation(
          'Board Members',
          'Admin: update board member',
          'Board member UUID'
        ),
        delete: adminDeleteOperation(
          'Board Members',
          'Admin: delete board member',
          'Board member UUID'
        ),
      },
      '/v1/board-members/{id}/headshot': {
        put: {
          tags: ['Board Members', 'Admin'],
          summary: 'Admin: replace a board member headshot and thumbnail',
          description:
            'Requires bearer auth with admin privileges. The full-size path must be {id}.{extension} at the bucket root and the thumbnail path must be exactly thumbnails/{id}.jpg. Uploads both objects to the board-headshots bucket with a one-year cache lifetime before updating headshotFile and headshotUpdatedAt on the board member. Returned object URLs are versioned with the new headshotUpdatedAt value.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Board member UUID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VersionedImageReplacementRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Both headshot variants uploaded and the board member updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          boardMember: { $ref: '#/components/schemas/BoardMember' },
                          headshot: {
                            type: 'object',
                            properties: {
                              fullSizePath: { type: 'string' },
                              thumbnailPath: { type: 'string' },
                              fullSizeUrl: { type: 'string', format: 'uri' },
                              thumbnailUrl: { type: 'string', format: 'uri' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid member ID, object path, content, or media type' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin or referer is forbidden' },
            '404': { description: 'Board member not found' },
            '429': { description: 'Too Many Requests' },
          },
        },
      },

      // ═══════════════════════════════════════════════════════
      //  Events
      // ═══════════════════════════════════════════════════════
      '/v1/events': {
        get: {
          tags: ['Events'],
          summary: 'Get all events (paginated, filterable)',
          description:
            'Public requests return visible events. Admin requests require bearer auth with admin privileges and can return all events.',
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
              description: 'Page number',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
              description: 'Results per page',
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
              description: 'Search in title and description',
            },
            {
              name: 'startDate',
              in: 'query',
              schema: { type: 'string', format: 'date-time' },
              description: 'Only events starting on or after this date (ISO 8601 date or datetime)',
            },
            {
              name: 'endDate',
              in: 'query',
              schema: { type: 'string', format: 'date-time' },
              description:
                'Only events starting on or before this date (ISO 8601 date or datetime)',
            },
            {
              name: 'semester',
              in: 'query',
              schema: { type: 'string', example: 'S26' },
              description: 'Only events for the provided semester code ([F|S]YY)',
            },
            {
              name: 'sort',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['startTime:asc', 'startTime:desc'],
                default: 'startTime:asc',
              },
              description:
                'Explicit event-time ordering. Sorting is applied before pagination, so `page=1` is always the first page of the requested sort order.',
            },
          ],
          responses: {
            '200': {
              description: 'Paginated list of events',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      count: { type: 'integer' },
                      pagination: { $ref: '#/components/schemas/PaginationInfo' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Event' },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
        post: adminCreateOperation('Events', 'Admin: create event'),
      },
      '/v1/events/upcoming': {
        get: {
          tags: ['Events'],
          summary: 'Get upcoming events',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
              description: 'Max number of upcoming events to return',
            },
          ],
          responses: {
            '200': {
              description: 'List of upcoming events',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Event' },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
      },
      '/v1/events/{id}': {
        get: {
          tags: ['Events'],
          summary: 'Get a single event by ID',
          description:
            'Public requests return the event only if it is visible. Admin requests require bearer auth with admin privileges.',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Event UUID',
            },
          ],
          responses: {
            '200': {
              description: 'Event found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/Event' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid UUID',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
            '404': {
              description: 'Event not found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
          },
        },
        put: adminUpdateOperation('Events', 'Admin: update event', 'Event UUID'),
        delete: adminDeleteOperation('Events', 'Admin: delete event', 'Event UUID'),
      },
      '/v1/events/{id}/flyer': {
        put: {
          tags: ['Events', 'Admin'],
          summary: 'Admin: replace an event flyer and thumbnail',
          description:
            'Requires bearer auth with admin privileges. The full-size path must be {id}.{extension} at the bucket root and the thumbnail path must be exactly thumbnails/{id}.jpg. Uploads both objects to the event-flyers bucket with a one-year cache lifetime before updating flyerFile and updatedAt on the event. Returned object URLs are versioned with the new updatedAt value.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Event UUID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VersionedImageReplacementRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Both flyer variants uploaded and the event updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          event: { $ref: '#/components/schemas/Event' },
                          flyer: {
                            type: 'object',
                            properties: {
                              fullSizePath: { type: 'string' },
                              thumbnailPath: { type: 'string' },
                              fullSizeUrl: { type: 'string', format: 'uri' },
                              thumbnailUrl: { type: 'string', format: 'uri' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid event ID, object path, content, or media type' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin or referer is forbidden' },
            '404': { description: 'Event not found' },
            '429': { description: 'Too Many Requests' },
          },
        },
      },

      // ═══════════════════════════════════════════════════════
      //  Contact
      // ═══════════════════════════════════════════════════════
      '/v1/contact': {
        post: {
          tags: ['Contact'],
          summary: 'Submit a contact form',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['firstName', 'lastName', 'email', 'message'],
                  properties: {
                    firstName: {
                      type: 'string',
                      maxLength: 100,
                      description: 'First name of the sender',
                    },
                    lastName: {
                      type: 'string',
                      maxLength: 100,
                      description: 'Last name of the sender',
                    },
                    email: { type: 'string', format: 'email' },
                    company: {
                      type: 'string',
                      maxLength: 255,
                      description: 'Optional company name',
                    },
                    message: { type: 'string', maxLength: 5000 },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Contact form submitted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: {
                        type: 'string',
                        example: 'Thank you for your message. We will get back to you soon!',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '500': {
              description: 'Failed to save submission or send notification email',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
      },
      '/v1/contact-requests': {
        get: adminListOperation('Contact', 'Admin: list contact requests'),
        post: adminCreateOperation('Contact', 'Admin: create contact request'),
      },
      '/v1/contact-requests/{id}': {
        get: adminGetOperation(
          'Contact',
          'Admin: get contact request by ID',
          'Contact request UUID'
        ),
        put: adminUpdateOperation(
          'Contact',
          'Admin: update contact request',
          'Contact request UUID'
        ),
        delete: adminDeleteOperation(
          'Contact',
          'Admin: delete contact request',
          'Contact request UUID'
        ),
      },

      // ═══════════════════════════════════════════════════════
      //  Newsletter
      // ═══════════════════════════════════════════════════════
      '/v1/newsletter-sign-ups': {
        post: {
          tags: ['Newsletter'],
          summary: 'Sign up for the newsletter',
          description:
            'Subscribes the user to the Mailchimp newsletter list and saves the signup in the database. Email must be an NYU email address (@nyu.edu).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'first_name', 'last_name'],
                  properties: {
                    email: {
                      type: 'string',
                      format: 'email',
                      description: 'Must be an @nyu.edu address',
                      example: 'jd1234@nyu.edu',
                    },
                    first_name: { type: 'string', maxLength: 50 },
                    last_name: { type: 'string', maxLength: 50 },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'New signup created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string' },
                      data: { $ref: '#/components/schemas/NewsletterSignup' },
                    },
                  },
                },
              },
            },
            '409': {
              description: 'Email is already subscribed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error (invalid email, missing fields)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '500': {
              description: 'Mailchimp or database error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
      },
      '/v1/newsletter-signups': {
        get: adminListOperation('Newsletter', 'Admin: list newsletter signups'),
        post: adminCreateOperation('Newsletter', 'Admin: create newsletter signup'),
      },
      '/v1/newsletter-signups/{id}': {
        get: adminGetOperation(
          'Newsletter',
          'Admin: get newsletter signup by ID',
          'Newsletter signup UUID'
        ),
        put: adminUpdateOperation(
          'Newsletter',
          'Admin: update newsletter signup',
          'Newsletter signup UUID'
        ),
        delete: adminDeleteOperation(
          'Newsletter',
          'Admin: delete newsletter signup',
          'Newsletter signup UUID'
        ),
      },

      // ═══════════════════════════════════════════════════════
      //  Members
      // ═══════════════════════════════════════════════════════
      '/v1/members': {
        get: {
          tags: ['Members'],
          summary: 'Get all members',
          responses: {
            '200': {
              description: 'List of members',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Member' },
                      },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
        post: adminCreateOperation('Members', 'Admin: create member'),
      },
      '/v1/members/{id}': {
        put: adminUpdateOperation('Members', 'Admin: update member', 'Member UUID'),
        delete: adminDeleteOperation('Members', 'Admin: delete member', 'Member UUID'),
      },

      // ═══════════════════════════════════════════════════════
      //  Semesters
      // ═══════════════════════════════════════════════════════
      '/v1/semesters': {
        get: {
          tags: ['Semesters'],
          summary: 'Get all semesters',
          responses: {
            '200': {
              description: 'List of semesters',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Semester' },
                      },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
        post: adminCreateOperation('Semesters', 'Admin: create semester'),
      },
      '/v1/semesters/{id}': {
        put: adminUpdateOperation('Semesters', 'Admin: update semester', 'Semester UUID'),
        delete: adminDeleteOperation('Semesters', 'Admin: delete semester', 'Semester UUID'),
      },

      // ═══════════════════════════════════════════════════════
      //  Storage
      // ═══════════════════════════════════════════════════════
      '/v1/storage/buckets': {
        get: {
          tags: ['Storage', 'Admin'],
          summary: 'Admin: list Supabase storage buckets',
          description: 'Requires bearer auth with admin privileges.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Storage buckets',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/StorageBucket' },
                      },
                    },
                  },
                },
              },
            },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin or referer is forbidden' },
            '429': { description: 'Too Many Requests' },
          },
        },
      },
      '/v1/storage/buckets/{bucketId}/objects': {
        get: {
          tags: ['Storage', 'Admin'],
          summary: 'Admin: list bucket objects',
          description: 'Requires bearer auth with admin privileges.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'bucketId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Supabase Storage bucket ID',
            },
            {
              name: 'prefix',
              in: 'query',
              schema: { type: 'string', example: 'members' },
              description: 'Optional virtual folder prefix.',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: { type: 'string', enum: ['name', 'updated_at'], default: 'name' },
            },
            {
              name: 'order',
              in: 'query',
              schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Bucket objects',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      count: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/StorageObject' },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid prefix' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin or referer is forbidden' },
            '429': { description: 'Too Many Requests' },
          },
        },
        post: {
          tags: ['Storage', 'Admin'],
          summary: 'Admin: upload bucket object',
          description:
            'Requires bearer auth with admin privileges. Upload-with-upsert is rejected for event-flyers and board-headshots; use their resource-specific replacement endpoints.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'bucketId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Supabase Storage bucket ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StorageUploadRequest' },
              },
            },
          },
          responses: {
            '201': { description: 'Object uploaded' },
            '400': { description: 'Invalid path or missing content' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin or referer is forbidden' },
            '429': { description: 'Too Many Requests' },
          },
        },
        put: {
          tags: ['Storage', 'Admin'],
          summary: 'Admin: replace or rename/move bucket object',
          description:
            'Requires bearer auth with admin privileges. Replacements and moves in event-flyers and board-headshots are rejected; use the resource-specific replacement endpoints so both image variants and their cache version stay synchronized.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'bucketId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Supabase Storage bucket ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StorageUpdateRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Object replaced or moved' },
            '400': { description: 'Invalid path or missing update operation' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin or referer is forbidden' },
            '429': { description: 'Too Many Requests' },
          },
        },
        delete: {
          tags: ['Storage', 'Admin'],
          summary: 'Admin: delete bucket objects',
          description: 'Requires bearer auth with admin privileges.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'bucketId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Supabase Storage bucket ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StorageDeleteRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Objects deleted' },
            '400': { description: 'Invalid path or missing path list' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin or referer is forbidden' },
            '429': { description: 'Too Many Requests' },
          },
        },
      },

      // ═══════════════════════════════════════════════════════
      //  Site Config
      // ═══════════════════════════════════════════════════════
      '/v1/site-config': {
        get: {
          tags: ['Site Config'],
          summary: 'Get site configuration values',
          description:
            'Public requests require a comma-separated keys query parameter. Admin requests with bearer auth can omit keys and receive all site configuration rows.',
          parameters: [
            {
              name: 'keys',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description:
                'Comma-separated list of configuration keys to retrieve. Required for public requests.',
              example: 'applications_open,applications_url',
            },
          ],
          responses: {
            '200': {
              description: 'Site configuration values',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/SiteConfigItem' },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing required query parameter',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { $ref: '#/components/schemas/ApiError' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Forbidden (CORS/Referer)',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError403' } },
              },
            },
            '429': {
              description: 'Too Many Requests',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiError429' } },
              },
            },
          },
        },
        post: adminCreateOperation('Site Config', 'Admin: create site configuration value'),
      },
      '/v1/site-config/{id}': {
        get: {
          tags: ['Site Config', 'Admin'],
          summary: 'Admin: get site configuration value',
          description: 'Requires bearer auth with admin privileges.',
          security: [{ bearerAuth: [] }],
          parameters: [keyPathParameter('Site configuration key')],
          responses: {
            '200': {
              description: 'Site configuration value',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/SiteConfigItem' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid site configuration key' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin' },
            '404': { description: 'Site configuration value not found' },
            '429': { description: 'Too Many Requests' },
          },
        },
        put: {
          tags: ['Site Config', 'Admin'],
          summary: 'Admin: update site configuration value',
          description: 'Requires bearer auth with admin privileges.',
          security: [{ bearerAuth: [] }],
          parameters: [keyPathParameter('Site configuration key')],
          requestBody: adminRequestBody,
          responses: {
            '200': {
              description: 'Site configuration value updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/SiteConfigItem' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Validation error or empty update' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin' },
            '404': { description: 'Site configuration value not found' },
            '429': { description: 'Too Many Requests' },
          },
        },
        delete: {
          tags: ['Site Config', 'Admin'],
          summary: 'Admin: delete site configuration value',
          description: 'Requires bearer auth with admin privileges.',
          security: [{ bearerAuth: [] }],
          parameters: [keyPathParameter('Site configuration key')],
          responses: {
            '200': {
              description: 'Site configuration value deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/SiteConfigItem' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid site configuration key' },
            '401': { description: 'Missing or invalid bearer token' },
            '403': { description: 'Authenticated user is not an admin' },
            '404': { description: 'Site configuration value not found' },
            '429': { description: 'Too Many Requests' },
          },
        },
      },
    },
  },
  // No JSDoc annotations to scan — everything is defined inline above
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

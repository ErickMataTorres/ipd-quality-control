import {
  createClient,
  SupabaseClient,
  User,
} from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

type AppRole =
  | 'system_administrator'
  | 'quality_manager'
  | 'quality_supervisor'
  | 'viewer';

type Action =
  | 'list'
  | 'search-employees'
  | 'create'
  | 'update'
  | 'set-status'
  | 'reset-password';

interface BaseRequest {
  action: Action;
}

interface CreateRequest extends BaseRequest {
  action: 'create';
  email: string;
  password: string;
  employeeId: string;
  role: AppRole;
  defaultPlantId: string | null;
  plantIds: string[];
}

interface UpdateRequest extends BaseRequest {
  action: 'update';
  userId: string;
  email: string;
  employeeId: string;
  role: AppRole;
  defaultPlantId: string | null;
  plantIds: string[];
}

interface SetStatusRequest extends BaseRequest {
  action: 'set-status';
  userId: string;
  active: boolean;
}

interface ResetPasswordRequest
  extends BaseRequest {
  action: 'reset-password';
  userId: string;
  password: string;
}

interface ListRequest extends BaseRequest {
  action: 'list';
}

interface SearchEmployeesRequest
  extends BaseRequest {
  action: 'search-employees';
  search: string;
}

type ManageUsersRequest =
  | ListRequest
  | SearchEmployeesRequest
  | CreateRequest
  | UpdateRequest
  | SetStatusRequest
  | ResetPasswordRequest;

interface UserProfileRow {
  id: string;
  employee_id: string;
  role: AppRole;
  default_plant_id: string | null;
  preferred_theme:
    | 'system'
    | 'light'
    | 'dark';
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmployeeRow {
  id: string;
  employee_number: string;
  full_name: string;
  plant_id: string | null;
  shift_id: string | null;
  department_name: string | null;
  job_position: string | null;
  photo_path: string | null;
  active: boolean;
}

interface PlantRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface PlantAccessRow {
  user_id: string;
  plant_id: string;
  active: boolean;
}

interface ExistingProfileConfiguration {
  profile: UserProfileRow;
  plantIds: string[];
}

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/json; charset=utf-8',
      },
    },
  );
}

function getEnvironmentValue(
  legacyName: string,
  modernName: string,
): string {
  const legacyValue =
    Deno.env.get(legacyName);

  if (legacyValue) {
    return legacyValue;
  }

  const modernValue =
    Deno.env.get(modernName);

  if (!modernValue) {
    throw new Error(
      `Missing environment variable: ${legacyName} or ${modernName}.`,
    );
  }

  try {
    const parsed =
      JSON.parse(modernValue) as
        Record<string, string>;

    const defaultValue =
      parsed.default
      ?? Object.values(parsed)[0];

    if (!defaultValue) {
      throw new Error(
        `No key exists in ${modernName}.`,
      );
    }

    return defaultValue;
  } catch {
    return modernValue;
  }
}

function requiredString(
  value: unknown,
  fieldName: string,
): string {
  if (
    typeof value !== 'string'
    || !value.trim()
  ) {
    throw new RequestValidationError(
      `${fieldName} is required.`,
    );
  }

  return value.trim();
}

function validateEmail(
  value: unknown,
): string {
  const email =
    requiredString(
      value,
      'Email',
    ).toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {
    throw new RequestValidationError(
      'The email format is invalid.',
    );
  }

  return email;
}

function validatePassword(
  value: unknown,
): string {
  const password =
    requiredString(
      value,
      'Password',
    );

  if (password.length < 8) {
    throw new RequestValidationError(
      'The password must contain at least 8 characters.',
    );
  }

  return password;
}

function validateRole(
  value: unknown,
): AppRole {
  const validRoles:
    readonly AppRole[] = [
      'system_administrator',
      'quality_manager',
      'quality_supervisor',
      'viewer',
    ];

  if (
    typeof value !== 'string'
    || !validRoles.includes(
      value as AppRole,
    )
  ) {
    throw new RequestValidationError(
      'The selected application role is invalid.',
    );
  }

  return value as AppRole;
}

function validatePlantIds(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    throw new RequestValidationError(
      'plantIds must be an array.',
    );
  }

  return Array.from(
    new Set(
      value.map(item =>
        requiredString(
          item,
          'Plant identifier',
        ),
      ),
    ),
  );
}

class RequestValidationError
  extends Error {
  readonly status = 400;
}

class AuthorizationError
  extends Error {
  readonly status = 403;
}

async function listAllAuthUsers(
  adminClient:
    SupabaseClient,
): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;

  for (
    let page = 1;
    page <= 100;
    page += 1
  ) {
    const {
      data,
      error,
    } =
      await adminClient.auth.admin
        .listUsers({
          page,
          perPage,
        });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (
      data.users.length < perPage
    ) {
      break;
    }
  }

  return users;
}

async function loadExistingConfiguration(
  callerClient: SupabaseClient,
  userId: string,
): Promise<
  ExistingProfileConfiguration
> {
  const [
    profileResult,
    accessResult,
  ] = await Promise.all([
    callerClient
      .from('user_profiles')
      .select(`
        id,
        employee_id,
        role,
        default_plant_id,
        preferred_theme,
        active,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single(),

    callerClient
      .from('user_plant_access')
      .select(`
        user_id,
        plant_id,
        active
      `)
      .eq('user_id', userId)
      .eq('active', true),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (accessResult.error) {
    throw accessResult.error;
  }

  return {
    profile:
      profileResult.data as UserProfileRow,

    plantIds:
      (
        accessResult.data
        ?? []
      ).map(
        (
          access:
            PlantAccessRow,
        ) =>
          access.plant_id,
      ),
  };
}

async function configureProfile(
  callerClient: SupabaseClient,
  input: {
    userId: string;
    employeeId: string;
    role: AppRole;
    defaultPlantId: string | null;
    plantIds: string[];
    active: boolean;
  },
): Promise<void> {
  const {
    error,
  } = await callerClient.rpc(
    'configure_application_user',
    {
      user_id_value:
        input.userId,

      employee_id_value:
        input.employeeId,

      role_value:
        input.role,

      default_plant_id_value:
        input.defaultPlantId
        ?? undefined,

      plant_ids_value:
        input.plantIds,

      active_value:
        input.active,
    },
  );

  if (error) {
    throw error;
  }
}

async function handleList(
  callerClient: SupabaseClient,
  adminClient: SupabaseClient,
): Promise<Response> {
  const [
    authUsers,
    profileResult,
    plantResult,
    accessResult,
  ] = await Promise.all([
    listAllAuthUsers(adminClient),

    callerClient
      .from('user_profiles')
      .select(`
        id,
        employee_id,
        role,
        default_plant_id,
        preferred_theme,
        active,
        created_at,
        updated_at
      `),

    callerClient
      .from('plants')
      .select(`
        id,
        code,
        name,
        active
      `)
      .order('code'),

    callerClient
      .from('user_plant_access')
      .select(`
        user_id,
        plant_id,
        active
      `),
  ]);

  const firstError = [
    profileResult.error,
    plantResult.error,
    accessResult.error,
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const profiles =
    (profileResult.data ?? []) as UserProfileRow[];

  const employeeIds =
    Array.from(
      new Set(
        profiles.map(
          profile =>
            profile.employee_id,
        ),
      ),
    );

  let employees:
    EmployeeRow[] = [];

  if (employeeIds.length > 0) {
    const {
      data,
      error,
    } =
      await callerClient
        .from('employees')
        .select(`
          id,
          employee_number,
          full_name,
          plant_id,
          shift_id,
          department_name,
          job_position,
          photo_path,
          active
        `)
        .in('id', employeeIds);

    if (error) {
      throw error;
    }

    employees =
      (data ?? []) as EmployeeRow[];
  }

  const plants =
    (plantResult.data ?? []) as PlantRow[];

  const accesses =
    (accessResult.data ?? []) as PlantAccessRow[];

  const profileById =
    new Map(
      profiles.map(
        profile => [
          profile.id,
          profile,
        ],
      ),
    );

  const employeeById =
    new Map(
      employees.map(
        employee => [
          employee.id,
          employee,
        ],
      ),
    );

  const plantById =
    new Map(
      plants.map(
        plant => [
          plant.id,
          plant,
        ],
      ),
    );

  const plantIdsByUser =
    new Map<string, string[]>();

  for (const access of accesses) {
    if (!access.active) {
      continue;
    }

    const currentPlantIds =
      plantIdsByUser.get(
        access.user_id,
      )
      ?? [];

    currentPlantIds.push(
      access.plant_id,
    );

    plantIdsByUser.set(
      access.user_id,
      currentPlantIds,
    );
  }

  const users =
    authUsers
      .map(authUser => {
        const profile =
          profileById.get(
            authUser.id,
          )
          ?? null;

        const employee =
          profile
            ? employeeById.get(
              profile.employee_id,
            )
              ?? null
            : null;

        const defaultPlant =
          profile?.default_plant_id
            ? plantById.get(
              profile.default_plant_id,
            )
              ?? null
            : null;

        const plantIds =
          plantIdsByUser.get(
            authUser.id,
          )
          ?? [];

        return {
          id:
            authUser.id,

          email:
            authUser.email
            ?? '',

          emailConfirmedAt:
            authUser.email_confirmed_at
            ?? null,

          lastSignInAt:
            authUser.last_sign_in_at
            ?? null,

          authCreatedAt:
            authUser.created_at,

          bannedUntil:
            authUser.banned_until
            ?? null,

          profile,
          employee,
          defaultPlant,

          plants:
            plantIds
              .map(
                plantId =>
                  plantById.get(
                    plantId,
                  ),
              )
              .filter(Boolean),
        };
      })
      .sort(
        (left, right) => {
          const leftName =
            left.employee?.full_name
            ?? left.email;

          const rightName =
            right.employee?.full_name
            ?? right.email;

          return leftName.localeCompare(
            rightName,
            'es',
            {
              sensitivity: 'base',
            },
          );
        },
      );

  return jsonResponse({
    users,
    plants,
  });
}

async function handleSearchEmployees(
  request: SearchEmployeesRequest,
  callerClient: SupabaseClient,
): Promise<Response> {
  const search =
    requiredString(
      request.search,
      'Employee search',
    )
      .replace(/,/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const searchPattern =
    `%${search}%`;

  const {
    data: employeesData,
    error: employeesError,
  } =
    await callerClient
      .from('employees')
      .select(`
        id,
        employee_number,
        full_name,
        plant_id,
        shift_id,
        department_name,
        job_position,
        photo_path,
        active
      `)
      .or(
        `employee_number.ilike.${searchPattern},full_name.ilike.${searchPattern}`,
      )
      .order('active', {
        ascending: false,
      })
      .order('full_name')
      .limit(50);

  if (employeesError) {
    throw employeesError;
  }

  const employees =
    (employeesData ?? []) as EmployeeRow[];

  const employeeIds =
    employees.map(
      employee =>
        employee.id,
    );

  let linkedProfiles:
    Array<{
      id: string;
      employee_id: string;
    }> = [];

  if (employeeIds.length > 0) {
    const {
      data,
      error,
    } =
      await callerClient
        .from('user_profiles')
        .select(`
          id,
          employee_id
        `)
        .in(
          'employee_id',
          employeeIds,
        );

    if (error) {
      throw error;
    }

    linkedProfiles =
      (data ?? []) as
        Array<{
          id: string;
          employee_id: string;
        }>;
  }

  const linkedUserIdByEmployee =
    new Map(
      linkedProfiles.map(
        profile => [
          profile.employee_id,
          profile.id,
        ],
      ),
    );

  return jsonResponse({
    employees:
      employees.map(employee => ({
        ...employee,

        linkedUserId:
          linkedUserIdByEmployee.get(
            employee.id,
          )
          ?? null,
      })),
  });
}

async function handleCreate(
  request: CreateRequest,
  callerClient: SupabaseClient,
  adminClient: SupabaseClient,
): Promise<Response> {
  const email =
    validateEmail(request.email);

  const password =
    validatePassword(
      request.password,
    );

  const employeeId =
    requiredString(
      request.employeeId,
      'Employee identifier',
    );

  const role =
    validateRole(request.role);

  const plantIds =
    validatePlantIds(
      request.plantIds,
    );

  const defaultPlantId =
    request.defaultPlantId
      ? requiredString(
        request.defaultPlantId,
        'Default plant identifier',
      )
      : null;

  const {
    data,
    error,
  } = await adminClient.auth.admin
    .createUser({
      email,
      password,
      email_confirm: true,

      user_metadata: {
        employee_id:
          employeeId,
      },
    });

  if (error) {
    throw error;
  }

  const createdUser =
    data.user;

  try {
    await configureProfile(
      callerClient,
      {
        userId:
          createdUser.id,

        employeeId,
        role,
        defaultPlantId,
        plantIds,
        active: true,
      },
    );
  } catch (error) {
    await adminClient.auth.admin
      .deleteUser(
        createdUser.id,
        false,
      );

    throw error;
  }

  return jsonResponse(
    {
      user: {
        id:
          createdUser.id,

        email:
          createdUser.email
          ?? email,
      },
    },
    201,
  );
}

async function handleUpdate(
  request: UpdateRequest,
  callerClient: SupabaseClient,
  adminClient: SupabaseClient,
): Promise<Response> {
  const userId =
    requiredString(
      request.userId,
      'User identifier',
    );

  const email =
    validateEmail(request.email);

  const employeeId =
    requiredString(
      request.employeeId,
      'Employee identifier',
    );

  const role =
    validateRole(request.role);

  const plantIds =
    validatePlantIds(
      request.plantIds,
    );

  const defaultPlantId =
    request.defaultPlantId
      ? requiredString(
        request.defaultPlantId,
        'Default plant identifier',
      )
      : null;

  const existingConfiguration =
    await loadExistingConfiguration(
      callerClient,
      userId,
    );

  const {
    data: currentAuthUserData,
    error: currentAuthUserError,
  } =
    await adminClient.auth.admin
      .getUserById(userId);

  if (currentAuthUserError) {
    throw currentAuthUserError;
  }

  await configureProfile(
    callerClient,
    {
      userId,
      employeeId,
      role,
      defaultPlantId,
      plantIds,

      active:
        existingConfiguration
          .profile.active,
    },
  );

  const currentEmail =
    currentAuthUserData.user.email
    ?? '';

  if (
    currentEmail.toLowerCase()
    !== email
  ) {
    const {
      error: updateAuthError,
    } =
      await adminClient.auth.admin
        .updateUserById(
          userId,
          {
            email,
            email_confirm: true,
          },
        );

    if (updateAuthError) {
      await configureProfile(
        callerClient,
        {
          userId,

          employeeId:
            existingConfiguration
              .profile.employee_id,

          role:
            existingConfiguration
              .profile.role,

          defaultPlantId:
            existingConfiguration
              .profile.default_plant_id,

          plantIds:
            existingConfiguration
              .plantIds,

          active:
            existingConfiguration
              .profile.active,
        },
      );

      throw updateAuthError;
    }
  }

  return jsonResponse({
    user: {
      id: userId,
      email,
    },
  });
}

async function handleSetStatus(
  request: SetStatusRequest,
  callerClient: SupabaseClient,
  adminClient: SupabaseClient,
): Promise<Response> {
  const userId =
    requiredString(
      request.userId,
      'User identifier',
    );

  if (
    typeof request.active
    !== 'boolean'
  ) {
    throw new RequestValidationError(
      'The active status is invalid.',
    );
  }

  const existingConfiguration =
    await loadExistingConfiguration(
      callerClient,
      userId,
    );

  const targetBanDuration =
    request.active
      ? 'none'
      : '876000h';

  const rollbackBanDuration =
    request.active
      ? '876000h'
      : 'none';

  const {
    error: authStatusError,
  } =
    await adminClient.auth.admin
      .updateUserById(
        userId,
        {
          ban_duration:
            targetBanDuration,
        },
      );

  if (authStatusError) {
    throw authStatusError;
  }

  try {
    await configureProfile(
      callerClient,
      {
        userId,

        employeeId:
          existingConfiguration
            .profile.employee_id,

        role:
          existingConfiguration
            .profile.role,

        defaultPlantId:
          existingConfiguration
            .profile.default_plant_id,

        plantIds:
          existingConfiguration
            .plantIds,

        active:
          request.active,
      },
    );
  } catch (error) {
    await adminClient.auth.admin
      .updateUserById(
        userId,
        {
          ban_duration:
            rollbackBanDuration,
        },
      );

    throw error;
  }

  return jsonResponse({
    userId,
    active:
      request.active,
  });
}

async function handleResetPassword(
  request: ResetPasswordRequest,
  adminClient: SupabaseClient,
): Promise<Response> {
  const userId =
    requiredString(
      request.userId,
      'User identifier',
    );

  const password =
    validatePassword(
      request.password,
    );

  const {
    error,
  } =
    await adminClient.auth.admin
      .updateUserById(
        userId,
        {
          password,
        },
      );

  if (error) {
    throw error;
  }

  return jsonResponse({
    userId,
    passwordUpdated: true,
  });
}

Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    if (
      request.method === 'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers: corsHeaders,
        },
      );
    }

    if (
      request.method !== 'POST'
    ) {
      return jsonResponse(
        {
          error:
            'Only POST requests are supported.',
        },
        405,
      );
    }

    try {
      const authorization =
        request.headers.get(
          'Authorization',
        );

      if (!authorization) {
        return jsonResponse(
          {
            error:
              'The authorization header is required.',
          },
          401,
        );
      }

      const supabaseUrl =
        requiredString(
          Deno.env.get(
            'SUPABASE_URL',
          ),
          'SUPABASE_URL',
        );

      const publicKey =
        getEnvironmentValue(
          'SUPABASE_ANON_KEY',
          'SUPABASE_PUBLISHABLE_KEYS',
        );

      const secretKey =
        getEnvironmentValue(
          'SUPABASE_SERVICE_ROLE_KEY',
          'SUPABASE_SECRET_KEYS',
        );

      const callerClient =
        createClient(
          supabaseUrl,
          publicKey,
          {
            global: {
              headers: {
                Authorization:
                  authorization,
              },
            },

            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        );

      const adminClient =
        createClient(
          supabaseUrl,
          secretKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        );

      const {
        data: callerData,
        error: callerError,
      } =
        await callerClient.auth
          .getUser();

      if (
        callerError
        || !callerData.user
      ) {
        return jsonResponse(
          {
            error:
              'The authenticated session is invalid.',
          },
          401,
        );
      }

      const {
        data: callerProfile,
        error: callerProfileError,
      } =
        await callerClient
          .from('user_profiles')
          .select(`
            role,
            active
          `)
          .eq(
            'id',
            callerData.user.id,
          )
          .single();

      if (callerProfileError) {
        throw callerProfileError;
      }

      if (
        !callerProfile.active
        || callerProfile.role
          !== 'system_administrator'
      ) {
        throw new AuthorizationError(
          'Only a system administrator can manage users.',
        );
      }

      const body =
        (await request.json()) as ManageUsersRequest;

      if (
        !body
        || typeof body.action
          !== 'string'
      ) {
        throw new RequestValidationError(
          'A valid action is required.',
        );
      }

      switch (body.action) {
        case 'list':
          return handleList(
            callerClient,
            adminClient,
          );

        case 'search-employees':
          return handleSearchEmployees(
            body,
            callerClient,
          );

        case 'create':
          return handleCreate(
            body,
            callerClient,
            adminClient,
          );

        case 'update':
          return handleUpdate(
            body,
            callerClient,
            adminClient,
          );

        case 'set-status':
          return handleSetStatus(
            body,
            callerClient,
            adminClient,
          );

        case 'reset-password':
          return handleResetPassword(
            body,
            adminClient,
          );

        default:
          throw new RequestValidationError(
            'The requested action is not supported.',
          );
      }
    } catch (error: unknown) {
      console.error(
        'manage-users failed:',
        error,
      );

      let status =
        error instanceof
          RequestValidationError
          ? error.status
          : error instanceof
              AuthorizationError
            ? error.status
            : 500;

      const databaseError =
        error as {
          code?: string;
          message?: string;
        };

      let message =
        databaseError.message
        ?? 'An unexpected error occurred.';

      if (
        databaseError.code
        === '23505'
      ) {
        message =
          'The email or employee is already linked to another user.';
      }

      if (
        databaseError.code
        === '42501'
      ) {
        status = 403;

        message =
          databaseError.message
          ?? 'You do not have permission to manage users.';
      }

      return jsonResponse(
        {
          error: message,
          code:
            databaseError.code
            ?? null,
        },
        status,
      );
    }
  },
);

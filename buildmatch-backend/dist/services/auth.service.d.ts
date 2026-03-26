import type { RegisterInput, LoginInput } from '../schemas/auth.schemas';
export declare function register(input: RegisterInput): Promise<{
    user: {
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.Role;
        phone: string | null;
        id: string;
        isVerified: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
    token: string;
}>;
export declare function login(input: LoginInput): Promise<{
    user: {
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.Role;
        phone: string | null;
        id: string;
        isVerified: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
    token: string;
}>;
export declare function getMe(userId: string): Promise<{
    email: string;
    firstName: string;
    lastName: string;
    role: import(".prisma/client").$Enums.Role;
    phone: string | null;
    id: string;
    isVerified: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
//# sourceMappingURL=auth.service.d.ts.map
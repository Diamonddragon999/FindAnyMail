import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                const validUser = credentials.username === process.env.ADMIN_USERNAME;
                const validPass = credentials.password === process.env.ADMIN_PASSWORD;
                if (validUser && validPass) {
                    return { id: '1', name: credentials.username, role: 'admin' };
                }
                return null;
            },
        }),
    ],
    session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
    pages: { signIn: '/login' },
    secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };

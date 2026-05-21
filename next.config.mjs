import withPWA from '@ducanh2912/next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    // Auth-protected routes must always go to the network — the middleware
    // checks a server-side cookie that the service worker cannot see.
    // Caching these routes (or their redirect responses) causes a redirect
    // loop where a previously-cached 307 is replayed on every navigation.
    runtimeCaching: [
      {
        urlPattern:
          /^\/(dashboard|operator|qa|team|workstations|reports|rework|audit-log|queue)(\/.*)?$/,
        handler: 'NetworkOnly',
      },
    ],
  },
})(nextConfig)

import { login } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        {/* Header Logo */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-green-800">
            Sistem Pesantren
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Pesantren Sukahideng
          </p>
        </div>

        {/* Form Login */}
        <form className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Input Email */}
            <div className="mb-4">
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Alamat Email"
              />
            </div>
            {/* Input Password */}
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          {/* Pesan Error (Jika ada) */}
          {searchParams?.error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {searchParams.error}
            </div>
          )}

          {/* Tombol Submit */}
          <div>
            <button
              formAction={login}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              Masuk Aplikasi
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
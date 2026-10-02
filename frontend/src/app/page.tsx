export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold">AI Grading System</h1>
        <p className="mt-4 text-gray-600">
          Intelligent automated grading and plagiarism detection for educators
        </p>
        
        <div className="mt-8">
          <a href="/auth/login" className="bg-blue-500 text-white px-6 py-2 rounded">
            Login
          </a>
        </div>
      </div>
    </main>
  )
}

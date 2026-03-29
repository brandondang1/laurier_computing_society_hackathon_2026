import React from 'react';

export default function LandingPage({ roomId, setRoomId, username, setUsername, joinRoom }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl text-center border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"></path><path d="m18 13-1.5-7.5L2 2l5.5 14.5L13 18l5-5z"></path><path d="m2 2 7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
          </div>
        </div>
        <h1 className="text-3xl font-extrabold mb-2 text-slate-900 tracking-tight">Recall</h1>
        <p className="text-slate-500 mb-8">Collaborative Real-time Whiteboard</p>
        
        <form onSubmit={joinRoom} className="space-y-4">
          <div className="text-left">
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1 ml-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-slate-900"
              required
            />
          </div>

          <div className="text-left">
            <label htmlFor="room-id" className="block text-sm font-medium text-slate-700 mb-1 ml-1">
              Room ID
            </label>
            <input
              id="room-id"
              type="text"
              placeholder="e.g. hackathon-2026"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-slate-900"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-200 hover:shadow-blue-300 transform transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-md duration-200"
          >
            Enter Room
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-top border-slate-100 text-slate-400 text-xs uppercase tracking-widest font-semibold">
          Built for LCS Hackathon
        </div>
      </div>
    </div>
  );
}

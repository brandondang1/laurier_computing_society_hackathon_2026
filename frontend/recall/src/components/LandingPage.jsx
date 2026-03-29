import React from 'react';

export default function LandingPage({ roomId, setRoomId, joinRoom }) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={joinRoom} className="bg-white p-8 rounded-lg shadow-xl text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Join a Drawing Room</h1>
        <input
          type="text"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="w-full border-2 border-gray-300 rounded px-4 py-2 mb-4 focus:outline-none focus:border-blue-500"
          required
        />
        <button 
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
        >
          Enter Room
        </button>
      </form>
    </div>
  );
}

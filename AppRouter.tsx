// AppRouter.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import ScrollRestoration from './components/ScrollRestoration';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollRestoration />
      <Routes>
        {/* Main routes */}
        <Route path="/" element={<App initialView="home" />} />
        <Route path="/feed" element={<App initialView="home" />} />
        
        {/* Legal Pages */}
        <Route path="/privacy" element={<App initialView="privacy" />} />
        <Route path="/terms" element={<App initialView="terms" />} />
        
        {/* Settings & Support */}
        <Route path="/settings" element={<App initialView="settings" />} />
        <Route path="/help" element={<App initialView="help" />} />
        
        {/* Main Features */}
        <Route path="/reels" element={<App initialView="reels" />} />
        <Route path="/marketplace" element={<App initialView="marketplace" />} />
        <Route path="/groups" element={<App initialView="groups" />} />
        <Route path="/music" element={<App initialView="music" />} />
        <Route path="/events" element={<App initialView="events" />} />
        <Route path="/notifications" element={<App initialView="notifications" />} />
        <Route path="/messages" element={<App initialView="messages" />} />
        
        {/* Profile Routes */}
        <Route path="/profile/:userId" element={<App initialView="profile" />} />
        <Route path="/@:username" element={<App initialView="profile" />} />
        
        {/* ✅ SEO-FRIENDLY DEEP LINK ROUTES WITH OPTIONAL SLUGS */}
        <Route path="/post/:postId/:slug?" element={<App initialView="post" />} />
        <Route path="/p/:postId/:slug?" element={<App initialView="post" />} />
        
        <Route path="/reel/:reelId/:slug?" element={<App initialView="reel" />} />
        <Route path="/r/:reelId/:slug?" element={<App initialView="reel" />} />
        
        <Route path="/group/:groupId/:slug?" element={<App initialView="group" />} />
        <Route path="/g/:groupId/:slug?" element={<App initialView="group" />} />
        
        <Route path="/event/:eventId/:slug?" element={<App initialView="event" />} />
        <Route path="/e/:eventId/:slug?" element={<App initialView="event" />} />
        
        <Route path="/music/:musicId/:slug?" element={<App initialView="music-item" />} />
        <Route path="/m/:musicId/:slug?" element={<App initialView="music-item" />} />
        
        <Route path="/product/:productId/:slug?" element={<App initialView="product" />} />
        
        {/* Group Posts */}
        <Route path="/group/:groupId/post/:postId/:slug?" element={<App initialView="group-post" />} />
        <Route path="/gp/:groupId/:postId/:slug?" element={<App initialView="group-post" />} />
        
        {/* Catch all */}
        <Route path="*" element={<App initialView="home" />} />
      </Routes>
    </BrowserRouter>
  );
}

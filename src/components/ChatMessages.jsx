import { useLayoutEffect, useState } from 'react';

function ChatMessages({
  messages,
  onSend,
  sending,
  username,
  inputRef,
  newMsg,
  setNewMsg,
  messagesEndRef,
  placeholder = 'Type your message...',
  children,
  onScheduleSend, // optional callback for scheduled send
  onSendImage, // new prop for image upload
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Scroll to bottom on new messages
  useLayoutEffect(() => {
    if (messagesEndRef?.current) {
      window.requestAnimationFrame(() => {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages, messagesEndRef]);

  const handleSchedule = (e) => {
    e.preventDefault();
    setShowSchedule(true);
    setScheduleTime("");
    setScheduleError("");
  };

  const handleScheduleConfirm = (e) => {
    e.preventDefault();
    if (!scheduleTime) {
      setScheduleError("Please select a date and time.");
      return;
    }
    const scheduledDate = new Date(scheduleTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      setScheduleError("Please select a valid future date and time.");
      return;
    }
    if (!newMsg.trim()) {
      setScheduleError("Message cannot be empty.");
      return;
    }
    setShowSchedule(false);
    setScheduleError("");
    if (onScheduleSend) {
      onScheduleSend(newMsg, scheduledDate);
    }
    setNewMsg("");
  };

  // Handle image upload
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // Cloudinary unsigned upload
      const url = 'https://api.cloudinary.com/v1_1/dvtpipmym/upload';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', '<your-upload-preset>');
      const res = await fetch(url, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url && onSendImage) {
        onSendImage(data.secure_url);
      }
    } catch (err) {
      alert('Image upload failed.');
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, height: 400, overflowY: 'auto', background: '#fafafa', margin: '30px 0' }}>
            {messages.length === 0 ? (
              <p style={{ color: '#888' }}>No messages yet.</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} style={{ textAlign: msg.senderUsername === username ? 'right' : 'left', margin: '8px 0' }}>
                  <span style={{ fontWeight: 'bold', color: msg.senderUsername === username ? '#1976d2' : '#333' }}>{msg.senderUsername}</span>
                  {msg.type === 'image' && msg.imageUrl ? (
                    <img src={msg.imageUrl} alt="chat-img" style={{ maxWidth: 180, maxHeight: 180, display: 'block', margin: '8px 0' }} />
                  ) : (
                    <span style={{ marginLeft: 8 }}>{msg.text}</span>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        {children && (
          <div style={{ minWidth: 120, marginLeft: 16, textAlign: 'right' }}>{children}</div>
        )}
      </div>
      <form onSubmit={onSend} style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          disabled={sending}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(e);
            }
          }}
        />
        <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.5 : 1 }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} disabled={uploading} />
          <span role="img" aria-label="Upload" style={{ fontSize: 20, padding: '0 8px' }}>📷</span>
        </label>
        <button type="submit" disabled={sending || !newMsg.trim()}>Send</button>
        <button type="button" onClick={handleSchedule} disabled={sending || !newMsg.trim()}>Scheduled Send</button>
      </form>
      {showSchedule && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 300, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <h3>Schedule Message</h3>
            <form onSubmit={handleScheduleConfirm}>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                style={{ width: '100%', marginBottom: 12, padding: 8 }}
              />
              {scheduleError && <div style={{ color: 'red', marginBottom: 8 }}>{scheduleError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowSchedule(false)}>Cancel</button>
                <button type="submit">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatMessages;

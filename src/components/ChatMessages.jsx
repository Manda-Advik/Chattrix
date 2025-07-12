import { useLayoutEffect, useState } from 'react';
import '../chatroom.css';

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
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleError, setScheduleError] = useState("");

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

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
      <div className="chat-main-container">
        <div className="chat-layout-container">
          <div className="chat-messages-section">
            <div className="chat-messages-area">
              {messages.length === 0 ? (
                <p style={{ color: '#888' }}>No messages yet.</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="chat-message-item" style={{ textAlign: msg.senderUsername === username ? 'right' : 'left' }}>
                    <span
                      className={
                        msg.senderUsername === username
                          ? 'chat-message-username self'
                          : 'chat-message-username'
                      }
                    >
                      {msg.senderUsername}
                    </span>
                    <span className="chat-message-text">{msg.text}</span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
        <div className="message-form-container">
          <form onSubmit={onSend} className="message-form">
            <input
              ref={inputRef}
              type="text"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder={placeholder}
              className="message-input"
              disabled={sending}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend(e);
                }
              }}
            />
            <div className="message-buttons">
              <button type="submit" disabled={sending || !newMsg.trim()}>Send</button>
              <button type="button" onClick={handleSchedule} disabled={sending || !newMsg.trim()}>Scheduled Send</button>
            </div>
          </form>
        </div>
        {showSchedule && (
          <div className="schedule-modal-overlay">
            <div className="schedule-modal-content">
              <h3>Schedule Message</h3>
              <form onSubmit={handleScheduleConfirm}>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="schedule-modal-input"
                />
                {scheduleError && <div className="schedule-modal-error">{scheduleError}</div>}
                <div className="schedule-modal-buttons">
                  <button type="button" onClick={() => setShowSchedule(false)} className="schedule-modal-button schedule-modal-cancel">Cancel</button>
                  <button type="submit" className="schedule-modal-button schedule-modal-confirm">Confirm</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      {children && (
        <div className="chat-members-section">{children}</div>
      )}
    </div>
  );
}

export default ChatMessages;

import { useState } from 'react';
import { Link } from 'react-router-dom';

function SignInForm() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement actual sign in logic in Phase 2
    console.log('Sign in:', formData);
    alert('Sign in functionality will be implemented in Phase 2!');
  };

  return (
    <div className="auth-container">
      <h1 className="page-title">Sign In</h1>
      
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            className="input"
            placeholder="Enter your username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            className="input"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Sign In
        </button>
      </form>
      
      <div className="auth-footer">
        <p>Don't have an account?</p>
        <Link to="/create-account" className="link">
          Create Account
        </Link>
      </div>
    </div>
  );
}

export default SignInForm;

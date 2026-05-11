-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) DEFAULT '',
    permissions VARCHAR(500) DEFAULT '',
    department_access VARCHAR(255) DEFAULT '',
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Seed default roles
INSERT INTO roles (
        role_name,
        description,
        permissions,
        department_access,
        status
    )
VALUES (
        'admin',
        'Full system access',
        'dashboard,employees,attendance,leaves,payroll,roles',
        'All',
        'Active'
    ),
    (
        'employee',
        'Basic employee access',
        'dashboard,attendance,leaves,payroll',
        'Own',
        'Active'
    ),
    (
        'hr',
        'Human resource management',
        'dashboard,employees,attendance,leaves',
        'All',
        'Active'
    ),
    (
        'accountant',
        'Finance and payroll management',
        'dashboard,payroll',
        'Finance',
        'Active'
    ) ON CONFLICT (role_name) DO NOTHING;
-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'employee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    department VARCHAR(100),
    designation VARCHAR(100),
    salary DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Active',
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP
);
-- Create leaves_data table
CREATE TABLE IF NOT EXISTS leaves_data (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type VARCHAR(50) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL,
    amount DECIMAL(10, 2) DEFAULT 0,
    net_salary DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'Pending',
    status VARCHAR(20) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_role VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
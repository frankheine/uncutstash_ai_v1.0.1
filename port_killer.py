import psutil
import sys

def kill_ports(ports):
    killed_count = 0
    
    # Iterate through all active network connections
    for conn in psutil.net_connections(kind='inet'):
        # Check if the connection is on a target port and has an associated PID
        if conn.laddr.port in ports and conn.pid:
            try:
                process = psutil.Process(conn.pid)
                process_name = process.name()
                
                # Force kill the process
                process.kill() 
                print(f"✅ Killed process '{process_name}' (PID: {conn.pid}) on port {conn.laddr.port}.")
                killed_count += 1
                
            except psutil.AccessDenied:
                print(f"❌ Access Denied: Could not kill PID {conn.pid} on port {conn.laddr.port}.")
                print("💡 Try running this script as an Administrator (Windows) or with 'sudo' (Mac/Linux).")
            except psutil.NoSuchProcess:
                # Process already died before we could kill it
                pass 
                
    if killed_count == 0:
        print(f"ℹ️ No active processes found on port(s): {', '.join(map(str, ports))}")

def main():
    print("Which ports would you like to clear?")
    print("1. Port 5173 only")
    print("2. Ports 5173 AND 5174 simultaneously")
    
    choice = input("\nEnter your choice (1 or 2): ").strip()
    
    print("-" * 40)
    if choice == '1':
        kill_ports([5173])
    elif choice == '2':
        kill_ports([5173, 5174])
    else:
        print("Invalid selection. Exiting.")
        sys.exit(1)
    print("-" * 40)

if __name__ == '__main__':
    main()
import argparse

import psutil



# A safe list of common development ports (React, Vue, Vite, Angular, Django, Next.js, etc.)

# You can easily add or remove ports from this list based on what you normally use.

COMMON_DEV_PORTS = [3000, 3001, 4000, 4200, 5000, 5173, 8000, 8080]



def kill_processes_on_ports(target_ports):

    """Safely kills processes listening only on the provided list of target ports."""

    killed_any = False

    

    # Iterate through all network connections

    for conn in psutil.net_connections(kind='inet'):

        if conn.laddr.port in target_ports and conn.pid:

            try:

                proc = psutil.Process(conn.pid)

                proc_name = proc.name()

                port = conn.laddr.port

                

                # Extra safety check: You could filter by proc_name like 'node' or 'python' if desired

                proc.kill()

                print(f"[SUCCESS] Cleared port {port} (Killed '{proc_name}', PID: {conn.pid})")

                killed_any = True

                

            except psutil.NoSuchProcess:

                pass # Process already closed

            except psutil.AccessDenied:

                print(f"[ERROR] Access denied to kill PID {conn.pid} on port {conn.laddr.port}.")

    

    if not killed_any:

        ports_str = ", ".join(map(str, target_ports))

        print(f"[INFO] No processes found running on target port(s): {ports_str}")



def main():

    parser = argparse.ArgumentParser(

        description="Safely clear specific ports left open by development servers (like npm run dev)."

    )

    

    parser.add_argument(

        '-p', '--ports', 

        nargs='+', 

        type=int, 

        help='Specify one or more port numbers to clear (e.g., -p 3000 8080).'

    )

    parser.add_argument(

        '-d', '--dev', 

        action='store_true', 

        help=f'Clear all common development ports safely: {COMMON_DEV_PORTS}'

    )



    args = parser.parse_args()



    # Determine which ports to target based on arguments

    target_ports = []

    

    if args.ports:

        target_ports.extend(args.ports)

    if args.dev:

        # Add dev ports to the list, removing duplicates if they manually specified one

        target_ports.extend([port for port in COMMON_DEV_PORTS if port not in target_ports])



    if not target_ports:

        parser.print_help()

        print("\n[!] Please specify a port using -p/--ports OR use the -d/--dev flag.")

    else:

        kill_processes_on_ports(target_ports)



if __name__ == "__main__":

    main()
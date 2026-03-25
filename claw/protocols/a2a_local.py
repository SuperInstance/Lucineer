"""A2A-Local: On-device agent-to-agent communication."""


class A2ALocal:
    """Local A2A protocol (on same chip/edge device)."""

    def __init__(self):
        """Initialize local A2A."""
        self.message_queue = []
        self.agents = {}  # Registered agents

    def register_agent(self, agent_id, agent):
        """Register an agent for local communication."""
        self.agents[agent_id] = agent
        print(f"[A2A-Local] Registered agent: {agent_id}")

    def send_message(self, from_agent, to_agent, message):
        """
        Send message between agents (no network latency).

        Args:
            from_agent: Sender agent ID
            to_agent: Recipient agent ID
            message: Message dict
        """
        if to_agent not in self.agents:
            raise ValueError(f"Agent not found: {to_agent}")

        # Direct function call (no serialization needed)
        recipient = self.agents[to_agent]
        response = recipient.process_message(from_agent, message)

        return response

    def broadcast(self, from_agent, message):
        """Broadcast message to all agents."""
        responses = {}
        for agent_id, agent in self.agents.items():
            if agent_id != from_agent:
                response = agent.process_message(from_agent, message)
                responses[agent_id] = response

        return responses

    def __repr__(self):
        return f"A2ALocal(agents={len(self.agents)})"

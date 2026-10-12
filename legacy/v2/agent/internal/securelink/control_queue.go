package securelink

const controlQueueLimit = 1024

// controlQueue is a Session-owned FIFO, used only while holding Session.mu.
// Storage grows lazily and stays bounded; draining retains reusable slots but
// clears their payload and completion references. A popped request belongs to
// the writer, so clearing its slot must not erase the request's payload.
type controlQueue struct {
	entries []outbound
	head    int
	size    int
}

func (q *controlQueue) len() int { return q.size }

// at returns a slot relative to the head. Coalescing uses offsets in [0, size);
// push uses size only after ensuring there is a free slot.
func (q *controlQueue) at(offset int) *outbound {
	index := q.head + offset
	if index >= len(q.entries) {
		index -= len(q.entries)
	}
	return &q.entries[index]
}

func (q *controlQueue) push(request outbound) error {
	if q.size >= controlQueueLimit {
		return ErrLimit
	}
	if q.size == len(q.entries) {
		capacity := len(q.entries) * 2
		if capacity == 0 {
			capacity = 8
		}
		entries := make([]outbound, capacity)
		for i := 0; i < q.size; i++ {
			entries[i] = *q.at(i)
		}
		q.entries, q.head = entries, 0
	}
	*q.at(q.size) = request
	q.size++
	return nil
}

func (q *controlQueue) pop() (outbound, bool) {
	if q.size == 0 {
		return outbound{}, false
	}
	request := q.entries[q.head]
	q.entries[q.head] = outbound{}
	q.size--
	q.head++
	if q.size == 0 || q.head == len(q.entries) {
		q.head = 0
	}
	return request, true
}

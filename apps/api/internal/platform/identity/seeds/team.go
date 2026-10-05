package seeds

// member is a person on the Bool team. The team's accounts are production's
// starting data (C135): cmd/deploy creates them in every environment, and in
// development the demo seeder also gives them a password and the Google stand-in.
type member struct {
	email, name, phone string
}

// team are the platform's first accounts, with the details the team gave
// (2026-10-04). Emails and phones are personal data: never logged (C94).
var team = []member{
	{"shifau@bool.mv", "Ahmed Shifau", "+9607800272"},
	{"mariyam@bool.mv", "Mariyam Ahmed", "+9609818117"},
	{"ibrahim@bool.mv", "Ibrahim Hussain Shareef", "+9607909764"},
}

// TeamEmails are the team accounts' emails, in the team's order: the edition gives
// the team its memberships by them (C160).
func TeamEmails() []string {
	emails := make([]string, len(team))
	for i, m := range team {
		emails[i] = m.email
	}
	return emails
}

// E2EEmail is the account the end-to-end suite signs in with (C109), seeded in dev
// only by the demo seeder, with the team's public development password.
const E2EEmail = "e2e@bool.test"

// e2e is the end-to-end suite's account: a fixed account, so its membership can be
// seeded (C160); the suite no longer creates and deletes one per run.
var e2e = member{E2EEmail, "E2E Tester", "+9607770000"}

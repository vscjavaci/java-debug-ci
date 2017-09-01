class A {
    void m() {
        System.out.println("outer");
    }
}

public class BreakPointTest {
    public static void main(String[] args) {
        new BreakPointTest().go();

        for (int i = 0; i < 100; i++) {
            if (i < 99) {
                new A().m();
            } else {
                new A() {
                    void m() {
                        System.out.println("anonymous");
                    }
                }.m();
            }

        }
    }

    void go() {
        new A().m();
        class A {
            void m() {
                System.out.println("inner");
            }
        }
        new A().m();
    }

    static class A {
        void m() {
            System.out.println("middle");
        }
    }
}